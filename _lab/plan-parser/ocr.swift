// قراءة ضوئية لصفحة خطة (2026-09-12)
//   ocr <ملف.pdf> <صفحة> [--scale 3] [--json] [--png مسار] [--crop x,y,w,h] [--nolc] [--lines]
//   ocr <ملف.pdf> <صفحة> --cells x,y,w,h;… [--tile k] [--rot -90|90] [--text] [--scale 6] [--png مسار]
// لخطط لا نص فيها يقرأ: صور ممسوحة (رياضيات الابتدائي) او خط بترميز خاص (رياضيات المتوسط).
// محرك Vision في النظام نفسه — لا اداة خارجية ولا ارسال لاي خادم.
//   --crop  منطقة بنقاط الصفحة (الاصل اسفل اليسار كما في pdf.js) — تقرأ وحدها مكبرة
//   --nolc  بلا تصحيح لغوي (للارقام المفردة)
//   --lines خطوط الجدول من الصورة نفسها (للصفحات الممسوحة التي لا خطوط مرسومة فيها)
import Foundation
import PDFKit
import Vision
import AppKit

var pos: [String] = [], opt: [String: String] = [:]
var it = CommandLine.arguments.dropFirst().makeIterator()
while let a = it.next() {
  if a.hasPrefix("--") { let k = String(a.dropFirst(2)); opt[k] = ["json", "nolc", "lines", "text"].contains(k) ? "1" : (it.next() ?? "") } else { pos.append(a) }
}
guard pos.count >= 2, let doc = PDFDocument(url: URL(fileURLWithPath: pos[0])), let pn = Int(pos[1]),
      let page = doc.page(at: pn - 1) else { print("الاستعمال: ocr <pdf> <صفحة> [--scale 3] [--json] [--png مسار] [--crop x,y,w,h] [--nolc] [--lines]"); exit(1) }
let scale = Double(opt["scale"] ?? "3") ?? 3
let asJSON = opt["json"] != nil
let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
func bitmap(_ w: Int, _ h: Int, _ data: UnsafeMutableRawPointer? = nil) -> CGContext? {
  CGContext(data: data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: data == nil ? 0 : w * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
}
func savePng(_ img: CGImage) {
  if let p = opt["png"], let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: p) as CFURL, "public.png" as CFString, 1, nil) {
    CGImageDestinationAddImage(dest, img, nil); CGImageDestinationFinalize(dest)
  }
}

let probe = VNRecognizeTextRequest()
probe.recognitionLevel = .accurate
guard ((try? probe.supportedRecognitionLanguages()) ?? []).contains(where: { $0.hasPrefix("ar") }) else { print("⚠ العربية غير مدعومة في Vision على هذا النظام"); exit(2) }

/* ── خانات بعينها: --cells x,y,w,h;x,y,w,h;…
   الرقم المفرد في خانته وحده لا يقرؤه المحرك البتة (جرب: صفر نتائج)، ومتباعدا في صف لا يقرؤه ايضا.
   فتقص كل خانة على حبرها (بعد محو خطوط الاطار) وترص متقاربة كسطر مكتوب «١ ٢ ١ ١»، ثم يعاد كل حرف
   الى خانته بموضعه. --tile k تكرر الخانة k مرات متلاصقة («٢٢») فتقوى القراءة ويؤخذ الاكثر بين النسخ.
   --rot -90 تدير الخانة (تسمية الاسبوع المكتوبة رأسيا) · --text تعيد سطورا كاملة لا حروفا (للكلمات). */
if let cs = opt["cells"] {
  /* «ص@x,y,w,h» خانة من صفحة اخرى في الملف نفسه (شواهد الجولة الثانية في ocrpage.mjs) */
  let specs = cs.split(separator: ";").compactMap { s -> (PDFPage, CGRect)? in
    let parts = s.split(separator: "@")
    let pg = parts.count == 2 ? (Int(parts[0]).flatMap { doc.page(at: $0 - 1) } ?? page) : page
    let v = parts.last!.split(separator: ",").compactMap { Double($0) }
    return v.count == 4 ? (pg, CGRect(x: v[0], y: v[1], width: v[2], height: v[3])) : nil }
  let rs = specs.map { $0.1 }
  if rs.isEmpty { print("{\"cells\":[]}"); exit(0) }
  let tile = max(1, Int(opt["tile"] ?? "1") ?? 1)
  let rot = Int(opt["rot"] ?? "0") ?? 0
  let textMode = opt["text"] != nil

  func render(_ pg: PDFPage, _ r: CGRect) -> CGImage? {
    let tw = rot != 0 ? r.height : r.width, th = rot != 0 ? r.width : r.height
    guard let c = bitmap(max(1, Int(tw * scale)), max(1, Int(th * scale))) else { return nil }
    c.setFillColor(white); c.fill(CGRect(x: 0, y: 0, width: c.width, height: c.height))
    c.scaleBy(x: scale, y: scale)
    /* -90: (u,v) ← (v, w-u) — ما يقرأ من الاسفل الى الاعلى يصير من اليسار الى اليمين */
    if rot == -90 { c.translateBy(x: 0, y: r.width); c.rotate(by: -.pi / 2) }
    else if rot == 90 { c.translateBy(x: r.height, y: 0); c.rotate(by: .pi / 2) }
    c.clip(to: CGRect(x: 0, y: 0, width: r.width, height: r.height))
    c.translateBy(x: -r.origin.x, y: -r.origin.y)
    pg.draw(with: .mediaBox, to: c)
    return c.makeImage()
  }
  /* يمحى كل صف او عمود بكسل داكن في اكثر من ٦٠٪ منه (بقية اطار الخانة)، ثم يقص على الحبر */
  func inkTrim(_ img: CGImage) -> CGImage? {
    let w = img.width, h = img.height, bpr = w * 4
    var px = [UInt8](repeating: 255, count: bpr * h)
    return px.withUnsafeMutableBytes { buf -> CGImage? in
      guard let g = bitmap(w, h, buf.baseAddress) else { return nil }
      g.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
      let p = buf.bindMemory(to: UInt8.self)
      func dark(_ x: Int, _ y: Int) -> Bool { let i = y * bpr + x * 4; return Int(p[i]) + Int(p[i + 1]) + Int(p[i + 2]) < 420 }
      func blank(_ x: Int, _ y: Int) { let i = y * bpr + x * 4; p[i] = 255; p[i + 1] = 255; p[i + 2] = 255 }
      var rowL = [Bool](repeating: false, count: h), colL = [Bool](repeating: false, count: w)
      for y in 0..<h { var n = 0; for x in 0..<w where dark(x, y) { n += 1 }; rowL[y] = Double(n) > Double(w) * 0.6 }
      for x in 0..<w { var n = 0; for y in 0..<h where dark(x, y) { n += 1 }; colL[x] = Double(n) > Double(h) * 0.6 }
      for y in 0..<h { for x in 0..<w where rowL[y] || colL[x] { blank(x, y) } }
      var x0 = w, x1 = -1, y0 = h, y1 = -1
      for y in 0..<h { for x in 0..<w where dark(x, y) { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) } }
      if x1 < 0 || (x1 - x0) * (y1 - y0) < 4 { return nil }
      let m = 3, cx0 = max(0, x0 - m), cy0 = max(0, y0 - m)
      return g.makeImage()?.cropping(to: CGRect(x: cx0, y: cy0, width: min(w, x1 + m + 1) - cx0, height: min(h, y1 + m + 1) - cy0))
    }
  }
  /* ⚠ ارتفاع الحبر يوحد (٤٨ بكسلا) لا التكبير: رقم التربية الفنية عريض كبير فصار بتكبير ٦ اضخم مما يقرؤه
     المحرك — «٢٢٢» واضحة لم يقرأ منها شيء، وبتكبير ٣ قرئت (2026-09-12). وللارقام وحدها: خانة الاسبوع سطران */
  func fit(_ img: CGImage, _ h: Int) -> CGImage? {
    if abs(img.height - h) * 5 < h { return img }
    let w = max(1, Int(Double(img.width) * Double(h) / Double(img.height)))
    guard let c = bitmap(w, h) else { return img }
    c.interpolationQuality = .high
    c.setFillColor(white); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
    c.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    return c.makeImage()
  }
  let glyph = Int(opt["glyph"] ?? "48") ?? 48
  let pieces = specs.map { s -> CGImage? in render(s.0, s.1).flatMap(inkTrim).flatMap { textMode ? $0 : fit($0, glyph) } }
  let ph0 = pieces.compactMap { $0?.height }.max() ?? 20
  /* --anchor «٣١»: شاهد مصطنع يرسم بخط النظام قبل الخانات — ملف ارقامه كلها واحدة («٢» في كل خانات التربية
     الفنية) لا شاهد فيه، وسطر من «٢٢٢» وحدها لا يقرؤه المحرك. والشاهد حكم: يعاد ما قرئ منه فيقارن */
  var anchorImg: CGImage? = nil
  if let a = opt["anchor"], !a.isEmpty {
    let font = NSFont(name: "Geeza Pro", size: CGFloat(ph0) * 1.25) ?? NSFont.systemFont(ofSize: CGFloat(ph0) * 1.25)
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: a, attributes: [.font: font, .foregroundColor: NSColor.black]))
    var asc: CGFloat = 0, desc: CGFloat = 0, lead: CGFloat = 0
    let tw = CTLineGetTypographicBounds(line, &asc, &desc, &lead)
    if let c = bitmap(Int(tw) + 16, Int(asc + desc) + 16) {
      c.setFillColor(white); c.fill(CGRect(x: 0, y: 0, width: c.width, height: c.height))
      c.textPosition = CGPoint(x: 8, y: 8 + desc); CTLineDraw(line, c)
      anchorImg = c.makeImage().flatMap(inkTrim)
    }
  }
  let ph = max(ph0, anchorImg?.height ?? 0)
  let tg = Int(Double(ph) * 0.15), cg = Int(Double(ph) * (textMode ? 2.5 : 1.2)), pad = ph
  /* مواضع كل خانة ونسخها في الصورة المركبة (بكسل، من اليسار) */
  var spans: [(s: Int, e: Int, tiles: [(Int, Int)])] = []
  var x = pad
  var aSpan: (Int, Int)? = nil
  if let a = anchorImg { aSpan = (x, x + a.width); x += a.width + cg }
  for p in pieces {
    guard let p = p else { spans.append((-1, -1, [])); continue }
    let s = x; var tr: [(Int, Int)] = []
    for k in 0..<tile { tr.append((x, x + p.width)); x += p.width + (k < tile - 1 ? tg : 0) }
    spans.append((s, x, tr)); x += cg
  }
  let CW = max(x - cg + pad, pad * 2), CH = ph + pad * 2
  guard let cc = bitmap(CW, CH) else { exit(3) }
  cc.setFillColor(white); cc.fill(CGRect(x: 0, y: 0, width: CW, height: CH))
  for (i, p) in pieces.enumerated() { guard let p = p else { continue }
    for (a, _) in spans[i].tiles { cc.draw(p, in: CGRect(x: a, y: pad + (ph - p.height) / 2, width: p.width, height: p.height)) } }
  if let a = anchorImg, let sp = aSpan { cc.draw(a, in: CGRect(x: sp.0, y: pad + (ph - a.height) / 2, width: a.width, height: a.height)) }
  guard let ci = cc.makeImage() else { exit(4) }
  savePng(ci)
  let rq = VNRecognizeTextRequest()
  rq.recognitionLevel = .accurate
  rq.recognitionLanguages = ["ar-SA", "en-US"]
  rq.usesLanguageCorrection = textMode
  try VNImageRequestHandler(cgImage: ci, options: [:]).perform([rq])
  func cellAt(_ mx: Double) -> Int? {
    spans.indices.first { i in spans[i].s >= 0 && mx >= Double(spans[i].s - cg / 2) && mx < Double(spans[i].e + cg / 2) }
  }
  var cells = [String](repeating: "", count: rs.count)
  var anchorChars: [(Double, Character)] = []
  if textMode {
    /* سطر كامل لخانته بمركزه — ترتيب السطور في الخانة من اليمين */
    var got = [[(Double, String)]](repeating: [], count: rs.count)
    for o in rq.results ?? [] { guard let c = o.topCandidates(1).first, let i = cellAt(Double(o.boundingBox.midX) * Double(CW)) else { continue }
      got[i].append((Double(o.boundingBox.midX), c.string)) }
    cells = got.map { $0.sorted { $0.0 > $1.0 }.map { $0.1 }.joined(separator: " ") }
  } else {
    /* لكل نسخة حروفها من اليسار (الارقام تكتب من اليسار ولو في سطر عربي) */
    var got = [[Int: [(Double, Character)]]](repeating: [:], count: rs.count)
    for o in rq.results ?? [] {
      guard let c = o.topCandidates(1).first else { continue }
      let s = c.string
      var ix = s.startIndex
      while ix < s.endIndex {
        let nx = s.index(after: ix)
        if !s[ix].isWhitespace, let bb = try? c.boundingBox(for: ix..<nx) {
          let mx = Double(bb.boundingBox.midX) * Double(CW)
          if let sp = aSpan, mx >= Double(sp.0 - cg / 2), mx < Double(sp.1 + cg / 2) { anchorChars.append((mx, s[ix])) }
          else if let i = cellAt(mx) {
            let k = spans[i].tiles.enumerated().min { abs(Double($0.element.0 + $0.element.1) / 2 - mx) < abs(Double($1.element.0 + $1.element.1) / 2 - mx) }?.offset ?? 0
            got[i][k, default: []].append((mx, s[ix]))
          }
        }
        ix = nx
      }
    }
    cells = got.map { byTile -> String in
      let reads = byTile.values.map { String($0.sorted { $0.0 < $1.0 }.map { $0.1 }) }.filter { !$0.isEmpty }
      var n: [String: Int] = [:]; reads.forEach { n[$0, default: 0] += 1 }
      return n.max { $0.value < $1.value || ($0.value == $1.value && $0.key.count < $1.key.count) }?.key ?? ""
    }
  }
  /* ink: هل في الخانة حبر — الفارغة في اصلها ليست فائتة.
     dash: حبرها افقي قصير (عرضه اكثر من ضعفي ونصف طوله) = شرطة «-»: الدرس بلا حصص في الخطة نفسها،
     لا رقم فاتت قراءته (رياضيات الثاني عشر علمي «الارتباط والانحدار») */
  let dash = pieces.map { p -> Bool in guard let p = p else { return false }; return Double(p.width) > Double(p.height) * 2.5 }
  /* dims: عرض الحبر وارتفاعه بعد القص (بهامشه) — لشكل الرقم حيث لا يقرؤه المحرك (2026-09-13: «١» خط رأسي مجرد) */
  let dims = pieces.map { p -> [Int] in guard let p = p else { return [0, 0] }; return [p.width, p.height] }
  /* sig: صورة الحبر مصغرة ١٠×١٤ ابيض واسود — الرقم المرسوم بخط واحد صورته واحدة، فتعرف الخانات المتماثلة ولو لم
     يقرأ المحرك بعضها («1» اللاتينية بذيلها ورأسها لا تفرق عن «٢» بنسبة ابعادها، وتفرق بصورتها — التربية الإسلامية ١١) */
  let sig = pieces.map { p -> String in
    guard let p = p, let c = bitmap(10, 14) else { return "" }
    c.interpolationQuality = .high
    c.setFillColor(white); c.fill(CGRect(x: 0, y: 0, width: 10, height: 14))
    c.draw(p, in: CGRect(x: 0, y: 0, width: 10, height: 14))
    guard let d = c.data else { return "" }
    let b = d.bindMemory(to: UInt8.self, capacity: c.bytesPerRow * 14)
    var s = ""
    for y in 0..<14 { for x in 0..<10 { let i = y * c.bytesPerRow + x * 4; s += (Int(b[i]) + Int(b[i + 1]) + Int(b[i + 2])) < 600 ? "1" : "0" } }
    return s }
  let data = try JSONSerialization.data(withJSONObject: ["cells": cells, "ink": pieces.map { $0 != nil }, "dash": dash, "dims": dims, "sig": sig, "anchor": String(anchorChars.sorted { $0.0 < $1.0 }.map { $0.1 }), "raw": (rq.results ?? []).compactMap { $0.topCandidates(1).first?.string }])
  print(String(data: data, encoding: .utf8)!)
  exit(0)
}

/* المنطقة المقروءة: الصفحة كلها او المقصوص منها */
let box = page.bounds(for: .mediaBox)
var area = box
if let c = opt["crop"] {
  let v = c.split(separator: ",").compactMap { Double($0) }
  if v.count == 4 { area = CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) }
}
let W = Int(area.width * scale), H = Int(area.height * scale)
guard let ctx = bitmap(W, H) else { exit(3) }
ctx.setFillColor(white); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
ctx.scaleBy(x: scale, y: scale)
ctx.translateBy(x: -area.origin.x, y: -area.origin.y)
page.draw(with: .mediaBox, to: ctx)
guard let img = ctx.makeImage() else { exit(4) }
savePng(img)

let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.recognitionLanguages = ["ar-SA", "en-US"]
req.usesLanguageCorrection = opt["nolc"] == nil
req.minimumTextHeight = 0
let t0 = Date()
try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
let obs = (req.results ?? []).compactMap { o -> (String, Float, CGRect)? in
  guard let c = o.topCandidates(1).first else { return nil }
  let b = o.boundingBox
  return (c.string, c.confidence, CGRect(x: area.origin.x + b.minX * area.width, y: area.origin.y + b.minY * area.height,
                                         width: b.width * area.width, height: b.height * area.height))
}

/* خطوط الجدول من البكسل: صف (او عمود) بكسل داكن متصل طويل = خط. الناتج بنقاط الصفحة
   بصيغة rects في lib2 (x,y,w,h) — فيقرؤها readTable كما يقرأ الخطوط المرسومة. */
var lines: [[String: Double]] = []
if opt["lines"] != nil {
  let bpr = img.width * 4
  var px = [UInt8](repeating: 255, count: bpr * img.height)
  px.withUnsafeMutableBytes { buf in bitmap(img.width, img.height, buf.baseAddress)?.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height)) }
  /* الصف 0 في المخزن = اعلى الصورة */
  func dark(_ x: Int, _ y: Int) -> Bool { let i = y * bpr + x * 4; return (Int(px[i]) + Int(px[i + 1]) + Int(px[i + 2])) < 420 }
  /* ⚠ المسح المائل: الخط الافقي ينزل بكسلا كل بضع مئات فيتقطع صف البكسل شرائح اقصر من العتبة — فسقطت
     حدود الاسابيع في عمود الاسبوع كله (رياضيات السادس ص٢-٣). يمد كل بكسل داكن بكسلين فوقه وتحته قبل تتبع
     الافقي، وبكسلين يمينه ويساره قبل تتبع الرأسي — فيصير الخط المائل شريطا يمر فيه صف متصل */
  let Wd = img.width, Hd = img.height, sm = 2
  var DH = [Bool](repeating: false, count: Wd * Hd), DV = DH
  for y in 0..<Hd { for x in 0..<Wd where dark(x, y) {
    for dy in -sm...sm { let yy = y + dy; if yy >= 0 && yy < Hd { DH[yy * Wd + x] = true } }
    for dx in -sm...sm { let xx = x + dx; if xx >= 0 && xx < Wd { DV[y * Wd + xx] = true } }
  } }
  /* اطول من اي جرة حرف: الافقي ٦٪ من العرض، والرأسي ٢٫٥٪ من الطول */
  let minH = Int(Double(img.width) * 0.06), minV = Int(Double(img.height) * 0.025)
  /* يسمح بفجوة بكسلين داخل الخط (مسح ضوئي باهت) */
  func runs(_ len: Int, _ at: (Int) -> Bool, _ minLen: Int) -> [(Int, Int)] {
    var out: [(Int, Int)] = [], s = -1, gap = 0
    for i in 0..<len {
      if at(i) { if s < 0 { s = i }; gap = 0 } else if s >= 0 { gap += 1; if gap > 2 { let e = i - gap; if e - s >= minLen { out.append((s, e)) }; s = -1; gap = 0 } }
    }
    if s >= 0 && len - 1 - s >= minLen { out.append((s, len - 1)) }
    return out
  }
  let k = 1.0 / scale
  for y in 0..<img.height { for (a, b) in runs(Wd, { DH[y * Wd + $0] }, minH) {
    lines.append(["x": area.origin.x + Double(a) * k, "y": area.origin.y + Double(img.height - 1 - y) * k, "w": Double(b - a) * k, "h": k]) } }
  for x in 0..<img.width { for (a, b) in runs(Hd, { DV[$0 * Wd + x] }, minV) {
    lines.append(["x": area.origin.x + Double(x) * k, "y": area.origin.y + Double(img.height - 1 - b) * k, "w": k, "h": Double(b - a) * k]) } }
}

if asJSON {
  let arr = obs.map { ["s": $0.0, "c": Double($0.1), "x": Double($0.2.minX), "y": Double($0.2.minY), "w": Double($0.2.width), "h": Double($0.2.height)] as [String: Any] }
  let data = try JSONSerialization.data(withJSONObject: ["items": arr, "lines": lines, "page": ["w": Double(box.width), "h": Double(box.height)]])
  print(String(data: data, encoding: .utf8)!)
} else {
  print(String(format: "الصفحة %d · %dx%d بكسل · %d سطرا في %.1f ث · خطوط %d", pn, W, H, obs.count, Date().timeIntervalSince(t0), lines.count))
  for o in obs.sorted(by: { $0.2.midY != $1.2.midY ? $0.2.midY > $1.2.midY : $0.2.midX > $1.2.midX }) {
    print(String(format: "%5.0f,%5.0f  %.2f  %@", o.2.minX, o.2.minY, o.1, o.0))
  }
}
