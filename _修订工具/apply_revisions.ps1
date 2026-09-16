# apply_revisions.ps1 —— 《梅尔基亚德斯的歌谣》修订执行脚本
# 只修改副本；原件先备份。全部改动在 XML 层以「段落 / <w:t> 节点」为粒度进行，保留原字体与段落格式。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root    = 'D:\Downloads\梅尔基亚德斯的歌谣'
$srcDoc  = Join-Path $root '梅尔基亚德斯的歌谣.docx'
$ch17Doc = Join-Path $root '梅尔基亚德斯的歌谣 章17.docx'
$outDoc  = Join-Path $root '梅尔基亚德斯的歌谣_修订版.docx'
$stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
$bakDir  = Join-Path $root '_修订备份'
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
Copy-Item $srcDoc (Join-Path $bakDir "梅尔基亚德斯的歌谣_原始备份_$stamp.docx") -Force
Copy-Item $srcDoc $outDoc -Force

$RXO  = [System.Text.RegularExpressions.RegexOptions]::Singleline
$PPAT = '<w:p(?:\s[^>]*)?>(?:(?!</w:p>).)*?</w:p>'
$TPAT = '<w:t(?:\s[^>]*)?>(.*?)</w:t>'
$FF02 = [char]0xFF02
$DQUO = [char]0x0022
$LQUO = [char]0x201C
$RQUO = [char]0x201D

function Read-Entry([string]$path, [string]$name) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
  try {
    $e = $zip.Entries | Where-Object { $_.FullName -eq $name }
    if (-not $e) { return $null }
    $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
    $t = $sr.ReadToEnd(); $sr.Close(); return $t
  } finally { $zip.Dispose() }
}
function ParaText([string]$pv) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($m in [regex]::Matches($pv, $TPAT, $RXO)) { [void]$sb.Append($m.Groups[1].Value) }
  return $sb.ToString()
}
function XmlEscape([string]$s) { return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;') }
function NodeContents([string]$pv) {
  $l = New-Object System.Collections.ArrayList
  foreach ($m in [regex]::Matches($pv, $TPAT, $RXO)) { [void]$l.Add($m.Groups[1].Value) }
  return , $l
}
function Set-ParaNodes([string]$pv, $contents) {
  $ms = [regex]::Matches($pv, $TPAT, $RXO)
  $sb = New-Object System.Text.StringBuilder
  $pos = 0
  for ($k = 0; $k -lt $ms.Count; $k++) {
    $m = $ms[$k]
    [void]$sb.Append($pv.Substring($pos, $m.Index - $pos))
    [void]$sb.Append($m.Value.Substring(0, $m.Value.IndexOf('>') + 1))
    [void]$sb.Append([string]$contents[$k])
    [void]$sb.Append('</w:t>')
    $pos = $m.Index + $m.Length
  }
  [void]$sb.Append($pv.Substring($pos))
  return $sb.ToString()
}
# 在段落文本中替换；返回新段落 XML，未命中返回 $null
function Replace-ParaText([string]$pv, [string]$old, [string]$new) {
  $contents = NodeContents $pv
  $full = -join $contents.ToArray()
  $idx = $full.IndexOf($old)
  if ($idx -lt 0) { return $null }
  if ($full.IndexOf($old, $idx + 1) -ge 0) { throw "锚点在段内不唯一: $old" }
  $starts = @(); $acc = 0
  foreach ($c in $contents) { $starts += $acc; $acc += ([string]$c).Length }
  $sp = $idx; $ep = $idx + $old.Length
  $sk = 0; $so = 0
  for ($k = $contents.Count - 1; $k -ge 0; $k--) { if ($sp -ge $starts[$k]) { $sk = $k; $so = $sp - $starts[$k]; break } }
  $ek = 0; $eo = 0
  for ($k = $contents.Count - 1; $k -ge 0; $k--) { if ($ep -ge $starts[$k]) { $ek = $k; $eo = $ep - $starts[$k]; break } }
  $prefix = ([string]$contents[$sk]).Substring(0, $so)
  if ($sk -eq $ek) {
    $contents[$sk] = $prefix + $new + ([string]$contents[$ek]).Substring($eo)
  } else {
    $contents[$sk] = $prefix + $new
    for ($k = $sk + 1; $k -lt $ek; $k++) { $contents[$k] = '' }
    $contents[$ek] = ([string]$contents[$ek]).Substring($eo)
  }
  return (Set-ParaNodes $pv $contents)
}
# 引号定向：偶数段落严格交替；奇数段落在交替基础上用上下文规则纠正；返回 @(新XML, 复核标记)
function Convert-Quotes([string]$pv) {
  $contents = NodeContents $pv
  $full = -join $contents.ToArray()
  $qp = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $full.Length; $i++) {
    $ch = $full[$i]
    if ($ch -eq $FF02 -or $ch -eq $DQUO) { [void]$qp.Add($i) }
  }
  if ($qp.Count -eq 0) { return @($pv, $null) }
  # 方向判定：以「段内严格交替」为准（作者用法一致，实测 1088 个偶数段落全部成立）
  $left = @()
  for ($k = 0; $k -lt $qp.Count; $k++) { $left += ($k % 2 -eq 0) }
  $notes = @()
  if ($qp.Count % 2 -ne 0) {
    # 奇数段落：靠首引号的位置判定整段奇偶起点
    $p0 = $qp[0]
    $before = $full.Substring(0, $p0)
    $afterAll = $full.Substring($p0 + 1)
    $isStart = ($before.Trim().Length -eq 0)
    $isEnd = ($afterAll.Trim().Length -eq 0)
    # 「首引号后紧跟『人名+言语动词+句读』」→ 该引号为闭引号
    $isClose = ($afterAll -match '^[\u4e00-\u9fa5]{2,4}(问道|说道|答道|回答道|回答|说|问|答)[。，！？…]')
    $flip = $false
    $why = '首引号在段首 → 开引号（左）'
    if (-not $isStart) {
      if ($isEnd) { $flip = $true; $why = '首引号在段末 → 闭引号（右）' }
      elseif ($isClose) { $flip = $true; $why = '首引号后紧跟言语归属 → 闭引号（右）' }
      else { $why = '首引号在段中且无归属特征 → 沿用交替法（左）' }
    }
    if ($flip) { for ($k = 0; $k -lt $qp.Count; $k++) { $left[$k] = -not $left[$k] } }
    $notes += ('奇数引号段(' + $qp.Count + '个)：' + $why)
  }
  # 写回
  $cursor = 0
  for ($k = 0; $k -lt $contents.Count; $k++) {
    $c = [string]$contents[$k]
    if ($c.Length -eq 0) { continue }
    $sb = New-Object System.Text.StringBuilder
    for ($j = 0; $j -lt $c.Length; $j++) {
      $ch = $c[$j]
      if ($ch -eq $FF02 -or $ch -eq $DQUO) {
        if ($left[$cursor]) { [void]$sb.Append($LQUO) } else { [void]$sb.Append($RQUO) }
        $cursor++
      } else { [void]$sb.Append($ch) }
    }
    $contents[$k] = $sb.ToString()
  }
  $note = if ($notes.Count -gt 0) { ($notes -join ' ') } else { $null }
  return @((Set-ParaNodes $pv $contents), $note)
}

# ================= 规则表 =================
$TextRules = @(
  @('完全不像一个十七岁的学生', '完全不像一个二十岁的学生', 'R1a'),
  @('那个十七岁的高中生', '那个二十岁的学生', 'R1b'),
  @('行政长官卡里姆·纳赛表示', '行政长官卡里姆·纳塞表示', 'R3a'),
  @('卡里姆·纳赛尔今天有四个会议', '卡里姆·纳塞今天有四个会议', 'R3b'),
  @('星瑠璃華，二十岁', '星琉璃華，二十岁', 'R4'),
  @('艾莉娜曾经去过', '艾琳娜曾经去过', 'R5'),
  @('来自中科院的李教授问道。他是一个四十五岁左右的男人', '来自中科院的李明慧教授问道。她是一个四十五岁左右的女性', 'R7'),
  @('自愿留守参与一号计划。', '自愿留守参与一号计划——该编号是核子中心观测计划的临时代号，事发突然，正式命名来不及走完流程，也不进入正式档案。', 'R8'),
  @('到2090年，月球基地将能够容纳一万名常驻人员', '月球基地目前已容纳约三十万名常驻人员', 'R11'),
  @('主要负责备份全球公开发布的科学、文化、历史数据', '主要负责备份全球已数字化的公开档案，以及与镜签约的机构所提供的非公开档案', 'R15'),
  # --- R22：第 22 章单章复审稿（梅尔基亚德斯的歌谣22.docx）的增量，按作者裁定写入主稿 ---
  @('不过手握权限总不是什么坏事。', '不过手握权限永远不是什么坏事。', 'R22a'),
  @('不要松手，匀速转动，我喊停你就停。', '不要松手，一直顺时针转动，我喊停你就停。', 'R22b'),
  @('把该记得的东西送出去了。', '把该记得的东西送出去了。他们没有选，我有得选。', 'R22c'),
  @('宥理会在讨论陷入僵局的时候去泡茶，回来继续争。', '宥理会在讨论陷入僵局的时候去泡杯茶，然后继续争。', 'R22d'),
  @('是那种让人清醒的、让思绪保持明晰的温度。', '是那种让人清醒的、让思绪保持明晰的温度。像是冬天的冷和夏天的冷的区别。', 'R22e')
)
$headFix = @{ 2446 = '二十六．'; 2577 = '二十七．'; 2726 = '二十八．' }
# R22f：新增一段，插入到主文档段 1975（「宰秦文需要的，只是把线重新穿进去。」）之后
$insAfterIdx = 1975
$insText = '至于第谷基地以百计的私人通信转接节点，波段太散了，远不如走鹊桥转通用波频合算。况且大和谐之后对第谷的情况完全就是一无所知，他们一路走到这里想要的不是把覆盖的真相淹没在一个没人在意的私人节点上。'

# ================= 读取与处理 =================
$xml = Read-Entry $srcDoc 'word/document.xml'
$pm = [regex]::Matches($xml, $PPAT, $RXO)
$P = New-Object System.Collections.ArrayList
$texts = @()
foreach ($m in $pm) { [void]$P.Add($m.Value); $texts += (ParaText $m.Value) }

$i17 = 1519; $i18 = 1595
$doR2 = $false      # R2 已由作者在主文档中修好（主文档 2026-09-11 02:25:40 更新），不再执行
$src17 = Read-Entry $ch17Doc 'word/document.xml'
$t17 = @()
foreach ($m in [regex]::Matches($src17, $PPAT, $RXO)) { $t17 += (ParaText $m.Value) }
$body17 = @()
foreach ($t in $t17) { if ($t.Trim() -ne '' -and $t.Trim() -notmatch '^[一二三四五六七八九十]{1,3}[．.]$') { $body17 += $t } }
$tplPPr = '<w:pPr><w:spacing w:line="840" w:lineRule="exact"/><w:ind w:firstLineChars="200" w:firstLine="560"/><w:rPr><w:rFonts w:ascii="宋体" w:hAnsi="宋体" w:cs="宋体"/><w:szCs w:val="28"/></w:rPr></w:pPr>'
$tplRPr = '<w:rPr><w:rFonts w:ascii="宋体" w:hAnsi="宋体" w:cs="宋体" w:hint="eastAsia"/><w:szCs w:val="28"/></w:rPr>'
$gen17 = @()
foreach ($t in $body17) { $gen17 += ('<w:p>' + $tplPPr + '<w:r>' + $tplRPr + '<w:t xml:space="preserve">' + (XmlEscape $t) + '</w:t></w:r></w:p>') }

$log = New-Object System.Collections.ArrayList
$mismatch = New-Object System.Collections.ArrayList
$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $P.Count; $i++) { [void]$out.Add($P[$i]) }
if ($doR2) {
  for ($i = $i17 + 1; $i -lt $i18; $i++) { $out[$i] = $null }
  [void]$log.Add("[R2] 用 章17.docx 正文 $($body17.Count) 段替换主文档段 $($i17+1)..$($i18-1)（移除 $($i18-$i17-1) 段）")
} else {
  [void]$log.Add("[R2] 已跳过：主文档第 17 章经作者修复后已是原稿（冲洗胶卷 / 银盐颗粒），无需回填")
}

$hitCount = @{}; foreach ($r in $TextRules) { $hitCount[$r[2]] = 0 }
for ($i = 0; $i -lt $P.Count; $i++) {
  if ($null -eq $out[$i]) { continue }
  $pv = $out[$i]
  if ($headFix.ContainsKey($i)) {
    $o = $texts[$i].Trim(); $n = $headFix[$i]
    $pv = Replace-ParaText $pv $o $n
    if ($pv) { $out[$i] = $pv; [void]$log.Add("[R17] 段$i 标题『$o』→『$n』") }
    continue
  }
  if ($pv.Contains('instrText')) {
    $tt = $texts[$i].Trim()
    if ($tt -match '^二十[六七八]\.') {
      $o = $tt.Substring(0, 4); $n = $tt.Substring(0, 3) + '．'
      $pv2 = Replace-ParaText $pv $o $n
      if ($pv2) { $out[$i] = $pv2; [void]$log.Add("[R17] 段$i 目录条目『$o』→『$n』") }
    }
    continue
  }
  foreach ($r in $TextRules) {
    if ($texts[$i].Contains($r[0])) {
      $res = Replace-ParaText $pv $r[0] $r[1]
      if ($res) { $pv = $res; $hitCount[$r[2]] = $hitCount[$r[2]] + 1; [void]$log.Add("[$($r[2])] 段$i 『$($r[0])』→『$($r[1])』") }
    }
  }
  $out[$i] = $pv
}
# 引号归一（在文本替换之后，避免干扰）
$qParas = 0; $qChars = 0
for ($i = 0; $i -lt $P.Count; $i++) {
  if ($null -eq $out[$i]) { continue }
  $t = $texts[$i]
  if ($t.Contains($FF02) -or $t.Contains($DQUO)) {
    $res = Convert-Quotes $out[$i]
    $out[$i] = $res[0]
    $qParas++
    $qChars += ([regex]::Matches($t, '[\uFF02\u0022]')).Count
    if ($res[1]) {
      $conv = ParaText $res[0]
      [void]$mismatch.Add("段$i  " + $res[1])
      [void]$mismatch.Add("    改后: " + $conv.Substring(0, [Math]::Min(150, $conv.Length)))
    }
  }
}
[void]$log.Add("[R16] 引号归一：$qParas 段 / $qChars 个引号")
[void]$log.Add("[R22f] 第 22 章新增 1 段（插入到段 $insAfterIdx 之后）")

foreach ($k in $hitCount.Keys) { if ($hitCount[$k] -ne 1) { [void]$log.Add("!! [$k] 命中 $($hitCount[$k]) 次（预期 1 次）") } }

# ================= 重建 document.xml =================
$sbx = New-Object System.Text.StringBuilder
$pos = 0
for ($i = 0; $i -lt $P.Count; $i++) {
  $m = $pm[$i]
  [void]$sbx.Append($xml.Substring($pos, $m.Index - $pos))
  if ($null -ne $out[$i]) { [void]$sbx.Append($out[$i]) }
  if ($doR2 -and $i -eq $i17) { foreach ($g in $gen17) { [void]$sbx.Append($g) } }
  if ($i -eq $insAfterIdx) { [void]$sbx.Append('<w:p>' + $tplPPr + '<w:r>' + $tplRPr + '<w:t xml:space="preserve">' + (XmlEscape $insText) + '</w:t></w:r></w:p>') }
  $pos = $m.Index + $m.Length
}
[void]$sbx.Append($xml.Substring($pos))
$newXml = $sbx.ToString()

# ================= settings.xml：强制更新域 =================
$setXml = Read-Entry $srcDoc 'word/settings.xml'
if (-not $setXml.Contains('updateFields')) {
  if ($setXml.Contains('<w:compat')) { $setXml = $setXml -replace '<w:compat', '<w:updateFields w:val="true"/><w:compat' }
  elseif ($setXml.Contains('<w:rsids')) { $setXml = $setXml -replace '<w:rsids', '<w:updateFields w:val="true"/><w:rsids' }
  else { $setXml = $setXml -replace '</w:settings>', '<w:updateFields w:val="true"/></w:settings>' }
  [void]$log.Add('[R18] 已在 settings.xml 写入 updateFields=true（打开时自动重建目录）')
}

# ================= 写出副本 =================
$zip = [System.IO.Compression.ZipFile]::Open($outDoc, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  foreach ($pair in @(@('word/document.xml', $newXml), @('word/settings.xml', $setXml))) {
    $en = $zip.Entries | Where-Object { $_.FullName -eq $pair[0] }
    if ($en) { $en.Delete() }
    $ne = $zip.CreateEntry($pair[0])
    $sw = New-Object System.IO.StreamWriter($ne.Open(), (New-Object System.Text.UTF8Encoding($false)))
    $sw.Write($pair[1]); $sw.Close()
  }
} finally { $zip.Dispose() }

# ================= 报告 =================
$rp = Join-Path $root ("_修订工具\执行报告_$stamp.txt")
$rlines = @()
$rlines += "修订执行报告  $stamp"
$rlines += "原件备份: " + (Join-Path $bakDir "梅尔基亚德斯的歌谣_原始备份_$stamp.docx")
$rlines += "输出副本: $outDoc"
$rlines += "原 document.xml: $($xml.Length) 字符  →  新: $($newXml.Length) 字符"
$newCount = $P.Count + 1
if ($doR2) { $newCount = $P.Count - ($i18 - $i17 - 1) + $gen17.Count }
$rlines += "段落数: $($P.Count)  →  新: $newCount"
$rlines += ""
$rlines += "---- 变更明细 ----"
$rlines += $log
$rlines += ""
$rlines += "---- 奇数引号段落的方向判定（逐个复核）----"
if ($mismatch.Count -eq 0) { $rlines += "（无）" } else { $rlines += $mismatch }
[System.IO.File]::WriteAllLines($rp, $rlines, (New-Object System.Text.UTF8Encoding($false)))
$rlines -join "`n"
