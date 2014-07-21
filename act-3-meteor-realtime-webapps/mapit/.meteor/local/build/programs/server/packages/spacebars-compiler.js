(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Spacebars = Package.spacebars.Spacebars;
var HTMLTools = Package['html-tools'].HTMLTools;
var _ = Package.underscore._;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var CssTools = Package.minifiers.CssTools;
var UglifyJSMinify = Package.minifiers.UglifyJSMinify;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var parseNumber, parseIdentifierName, parseStringLiteral, toJSLiteral, toObjectLiteralKey, TemplateTag;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/spacebars-compiler/tokens.js                                                                //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
// Adapted from source code of http://xregexp.com/plugins/#unicode                                      // 2
var unicodeCategories = {                                                                               // 3
  Ll: "0061-007A00B500DF-00F600F8-00FF01010103010501070109010B010D010F01110113011501170119011B011D011F01210123012501270129012B012D012F01310133013501370138013A013C013E014001420144014601480149014B014D014F01510153015501570159015B015D015F01610163016501670169016B016D016F0171017301750177017A017C017E-0180018301850188018C018D019201950199-019B019E01A101A301A501A801AA01AB01AD01B001B401B601B901BA01BD-01BF01C601C901CC01CE01D001D201D401D601D801DA01DC01DD01DF01E101E301E501E701E901EB01ED01EF01F001F301F501F901FB01FD01FF02010203020502070209020B020D020F02110213021502170219021B021D021F02210223022502270229022B022D022F02310233-0239023C023F0240024202470249024B024D024F-02930295-02AF037103730377037B-037D039003AC-03CE03D003D103D5-03D703D903DB03DD03DF03E103E303E503E703E903EB03ED03EF-03F303F503F803FB03FC0430-045F04610463046504670469046B046D046F04710473047504770479047B047D047F0481048B048D048F04910493049504970499049B049D049F04A104A304A504A704A904AB04AD04AF04B104B304B504B704B904BB04BD04BF04C204C404C604C804CA04CC04CE04CF04D104D304D504D704D904DB04DD04DF04E104E304E504E704E904EB04ED04EF04F104F304F504F704F904FB04FD04FF05010503050505070509050B050D050F05110513051505170519051B051D051F05210523052505270561-05871D00-1D2B1D6B-1D771D79-1D9A1E011E031E051E071E091E0B1E0D1E0F1E111E131E151E171E191E1B1E1D1E1F1E211E231E251E271E291E2B1E2D1E2F1E311E331E351E371E391E3B1E3D1E3F1E411E431E451E471E491E4B1E4D1E4F1E511E531E551E571E591E5B1E5D1E5F1E611E631E651E671E691E6B1E6D1E6F1E711E731E751E771E791E7B1E7D1E7F1E811E831E851E871E891E8B1E8D1E8F1E911E931E95-1E9D1E9F1EA11EA31EA51EA71EA91EAB1EAD1EAF1EB11EB31EB51EB71EB91EBB1EBD1EBF1EC11EC31EC51EC71EC91ECB1ECD1ECF1ED11ED31ED51ED71ED91EDB1EDD1EDF1EE11EE31EE51EE71EE91EEB1EED1EEF1EF11EF31EF51EF71EF91EFB1EFD1EFF-1F071F10-1F151F20-1F271F30-1F371F40-1F451F50-1F571F60-1F671F70-1F7D1F80-1F871F90-1F971FA0-1FA71FB0-1FB41FB61FB71FBE1FC2-1FC41FC61FC71FD0-1FD31FD61FD71FE0-1FE71FF2-1FF41FF61FF7210A210E210F2113212F21342139213C213D2146-2149214E21842C30-2C5E2C612C652C662C682C6A2C6C2C712C732C742C76-2C7B2C812C832C852C872C892C8B2C8D2C8F2C912C932C952C972C992C9B2C9D2C9F2CA12CA32CA52CA72CA92CAB2CAD2CAF2CB12CB32CB52CB72CB92CBB2CBD2CBF2CC12CC32CC52CC72CC92CCB2CCD2CCF2CD12CD32CD52CD72CD92CDB2CDD2CDF2CE12CE32CE42CEC2CEE2CF32D00-2D252D272D2DA641A643A645A647A649A64BA64DA64FA651A653A655A657A659A65BA65DA65FA661A663A665A667A669A66BA66DA681A683A685A687A689A68BA68DA68FA691A693A695A697A723A725A727A729A72BA72DA72F-A731A733A735A737A739A73BA73DA73FA741A743A745A747A749A74BA74DA74FA751A753A755A757A759A75BA75DA75FA761A763A765A767A769A76BA76DA76FA771-A778A77AA77CA77FA781A783A785A787A78CA78EA791A793A7A1A7A3A7A5A7A7A7A9A7FAFB00-FB06FB13-FB17FF41-FF5A",
  Lm: "02B0-02C102C6-02D102E0-02E402EC02EE0374037A0559064006E506E607F407F507FA081A0824082809710E460EC610FC17D718431AA71C78-1C7D1D2C-1D6A1D781D9B-1DBF2071207F2090-209C2C7C2C7D2D6F2E2F30053031-3035303B309D309E30FC-30FEA015A4F8-A4FDA60CA67FA717-A71FA770A788A7F8A7F9A9CFAA70AADDAAF3AAF4FF70FF9EFF9F",
  Lo: "00AA00BA01BB01C0-01C3029405D0-05EA05F0-05F20620-063F0641-064A066E066F0671-06D306D506EE06EF06FA-06FC06FF07100712-072F074D-07A507B107CA-07EA0800-08150840-085808A008A2-08AC0904-0939093D09500958-09610972-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE00AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E450E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC40EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066106E-10701075-1081108E10D0-10FA10FD-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-17311740-17511760-176C176E-17701780-17B317DC1820-18421844-18771880-18A818AA18B0-18F51900-191C1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541B05-1B331B45-1B4B1B83-1BA01BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C771CE9-1CEC1CEE-1CF11CF51CF62135-21382D30-2D672D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE3006303C3041-3096309F30A1-30FA30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A014A016-A48CA4D0-A4F7A500-A60BA610-A61FA62AA62BA66EA6A0-A6E5A7FB-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2AA00-AA28AA40-AA42AA44-AA4BAA60-AA6FAA71-AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADBAADCAAE0-AAEAAAF2AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF66-FF6FFF71-FF9DFFA0-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
  Lt: "01C501C801CB01F21F88-1F8F1F98-1F9F1FA8-1FAF1FBC1FCC1FFC",                                        // 7
  Lu: "0041-005A00C0-00D600D8-00DE01000102010401060108010A010C010E01100112011401160118011A011C011E01200122012401260128012A012C012E01300132013401360139013B013D013F0141014301450147014A014C014E01500152015401560158015A015C015E01600162016401660168016A016C016E017001720174017601780179017B017D018101820184018601870189-018B018E-0191019301940196-0198019C019D019F01A001A201A401A601A701A901AC01AE01AF01B1-01B301B501B701B801BC01C401C701CA01CD01CF01D101D301D501D701D901DB01DE01E001E201E401E601E801EA01EC01EE01F101F401F6-01F801FA01FC01FE02000202020402060208020A020C020E02100212021402160218021A021C021E02200222022402260228022A022C022E02300232023A023B023D023E02410243-02460248024A024C024E03700372037603860388-038A038C038E038F0391-03A103A3-03AB03CF03D2-03D403D803DA03DC03DE03E003E203E403E603E803EA03EC03EE03F403F703F903FA03FD-042F04600462046404660468046A046C046E04700472047404760478047A047C047E0480048A048C048E04900492049404960498049A049C049E04A004A204A404A604A804AA04AC04AE04B004B204B404B604B804BA04BC04BE04C004C104C304C504C704C904CB04CD04D004D204D404D604D804DA04DC04DE04E004E204E404E604E804EA04EC04EE04F004F204F404F604F804FA04FC04FE05000502050405060508050A050C050E05100512051405160518051A051C051E05200522052405260531-055610A0-10C510C710CD1E001E021E041E061E081E0A1E0C1E0E1E101E121E141E161E181E1A1E1C1E1E1E201E221E241E261E281E2A1E2C1E2E1E301E321E341E361E381E3A1E3C1E3E1E401E421E441E461E481E4A1E4C1E4E1E501E521E541E561E581E5A1E5C1E5E1E601E621E641E661E681E6A1E6C1E6E1E701E721E741E761E781E7A1E7C1E7E1E801E821E841E861E881E8A1E8C1E8E1E901E921E941E9E1EA01EA21EA41EA61EA81EAA1EAC1EAE1EB01EB21EB41EB61EB81EBA1EBC1EBE1EC01EC21EC41EC61EC81ECA1ECC1ECE1ED01ED21ED41ED61ED81EDA1EDC1EDE1EE01EE21EE41EE61EE81EEA1EEC1EEE1EF01EF21EF41EF61EF81EFA1EFC1EFE1F08-1F0F1F18-1F1D1F28-1F2F1F38-1F3F1F48-1F4D1F591F5B1F5D1F5F1F68-1F6F1FB8-1FBB1FC8-1FCB1FD8-1FDB1FE8-1FEC1FF8-1FFB21022107210B-210D2110-211221152119-211D212421262128212A-212D2130-2133213E213F214521832C00-2C2E2C602C62-2C642C672C692C6B2C6D-2C702C722C752C7E-2C802C822C842C862C882C8A2C8C2C8E2C902C922C942C962C982C9A2C9C2C9E2CA02CA22CA42CA62CA82CAA2CAC2CAE2CB02CB22CB42CB62CB82CBA2CBC2CBE2CC02CC22CC42CC62CC82CCA2CCC2CCE2CD02CD22CD42CD62CD82CDA2CDC2CDE2CE02CE22CEB2CED2CF2A640A642A644A646A648A64AA64CA64EA650A652A654A656A658A65AA65CA65EA660A662A664A666A668A66AA66CA680A682A684A686A688A68AA68CA68EA690A692A694A696A722A724A726A728A72AA72CA72EA732A734A736A738A73AA73CA73EA740A742A744A746A748A74AA74CA74EA750A752A754A756A758A75AA75CA75EA760A762A764A766A768A76AA76CA76EA779A77BA77DA77EA780A782A784A786A78BA78DA790A792A7A0A7A2A7A4A7A6A7A8A7AAFF21-FF3A",
  Mc: "0903093B093E-09400949-094C094E094F0982098309BE-09C009C709C809CB09CC09D70A030A3E-0A400A830ABE-0AC00AC90ACB0ACC0B020B030B3E0B400B470B480B4B0B4C0B570BBE0BBF0BC10BC20BC6-0BC80BCA-0BCC0BD70C01-0C030C41-0C440C820C830CBE0CC0-0CC40CC70CC80CCA0CCB0CD50CD60D020D030D3E-0D400D46-0D480D4A-0D4C0D570D820D830DCF-0DD10DD8-0DDF0DF20DF30F3E0F3F0F7F102B102C10311038103B103C105610571062-10641067-106D108310841087-108C108F109A-109C17B617BE-17C517C717C81923-19261929-192B193019311933-193819B0-19C019C819C91A19-1A1B1A551A571A611A631A641A6D-1A721B041B351B3B1B3D-1B411B431B441B821BA11BA61BA71BAA1BAC1BAD1BE71BEA-1BEC1BEE1BF21BF31C24-1C2B1C341C351CE11CF21CF3302E302FA823A824A827A880A881A8B4-A8C3A952A953A983A9B4A9B5A9BAA9BBA9BD-A9C0AA2FAA30AA33AA34AA4DAA7BAAEBAAEEAAEFAAF5ABE3ABE4ABE6ABE7ABE9ABEAABEC",
  Mn: "0300-036F0483-04870591-05BD05BF05C105C205C405C505C70610-061A064B-065F067006D6-06DC06DF-06E406E706E806EA-06ED07110730-074A07A6-07B007EB-07F30816-0819081B-08230825-08270829-082D0859-085B08E4-08FE0900-0902093A093C0941-0948094D0951-095709620963098109BC09C1-09C409CD09E209E30A010A020A3C0A410A420A470A480A4B-0A4D0A510A700A710A750A810A820ABC0AC1-0AC50AC70AC80ACD0AE20AE30B010B3C0B3F0B41-0B440B4D0B560B620B630B820BC00BCD0C3E-0C400C46-0C480C4A-0C4D0C550C560C620C630CBC0CBF0CC60CCC0CCD0CE20CE30D41-0D440D4D0D620D630DCA0DD2-0DD40DD60E310E34-0E3A0E47-0E4E0EB10EB4-0EB90EBB0EBC0EC8-0ECD0F180F190F350F370F390F71-0F7E0F80-0F840F860F870F8D-0F970F99-0FBC0FC6102D-10301032-10371039103A103D103E10581059105E-10601071-1074108210851086108D109D135D-135F1712-17141732-1734175217531772177317B417B517B7-17BD17C617C9-17D317DD180B-180D18A91920-19221927192819321939-193B1A171A181A561A58-1A5E1A601A621A65-1A6C1A73-1A7C1A7F1B00-1B031B341B36-1B3A1B3C1B421B6B-1B731B801B811BA2-1BA51BA81BA91BAB1BE61BE81BE91BED1BEF-1BF11C2C-1C331C361C371CD0-1CD21CD4-1CE01CE2-1CE81CED1CF41DC0-1DE61DFC-1DFF20D0-20DC20E120E5-20F02CEF-2CF12D7F2DE0-2DFF302A-302D3099309AA66FA674-A67DA69FA6F0A6F1A802A806A80BA825A826A8C4A8E0-A8F1A926-A92DA947-A951A980-A982A9B3A9B6-A9B9A9BCAA29-AA2EAA31AA32AA35AA36AA43AA4CAAB0AAB2-AAB4AAB7AAB8AABEAABFAAC1AAECAAEDAAF6ABE5ABE8ABEDFB1EFE00-FE0FFE20-FE26",
  Nd: "0030-00390660-066906F0-06F907C0-07C90966-096F09E6-09EF0A66-0A6F0AE6-0AEF0B66-0B6F0BE6-0BEF0C66-0C6F0CE6-0CEF0D66-0D6F0E50-0E590ED0-0ED90F20-0F291040-10491090-109917E0-17E91810-18191946-194F19D0-19D91A80-1A891A90-1A991B50-1B591BB0-1BB91C40-1C491C50-1C59A620-A629A8D0-A8D9A900-A909A9D0-A9D9AA50-AA59ABF0-ABF9FF10-FF19",
  Nl: "16EE-16F02160-21822185-218830073021-30293038-303AA6E6-A6EF",                                     // 12
  Pc: "005F203F20402054FE33FE34FE4D-FE4FFF3F"                                                           // 13
};                                                                                                      // 14
                                                                                                        // 15
var unicodeClass = function (abbrev) {                                                                  // 16
  return '[' +                                                                                          // 17
    unicodeCategories[abbrev].replace(/[0-9A-F]{4}/ig, "\\u$&") + ']';                                  // 18
};                                                                                                      // 19
                                                                                                        // 20
// See ECMA-262 spec, 3rd edition, Section 7.6                                                          // 21
// Match one or more characters that can start an identifier.                                           // 22
// This is IdentifierStart+.                                                                            // 23
var rIdentifierPrefix = new RegExp(                                                                     // 24
  "^([a-zA-Z$_]+|\\\\u[0-9a-fA-F]{4}|" +                                                                // 25
    [unicodeClass('Lu'), unicodeClass('Ll'), unicodeClass('Lt'),                                        // 26
     unicodeClass('Lm'), unicodeClass('Lo'), unicodeClass('Nl')].join('|') +                            // 27
    ")+");                                                                                              // 28
// Match one or more characters that can continue an identifier.                                        // 29
// This is (IdentifierPart and not IdentifierStart)+.                                                   // 30
// To match a full identifier, match rIdentifierPrefix, then                                            // 31
// match rIdentifierMiddle followed by rIdentifierPrefix until they both fail.                          // 32
var rIdentifierMiddle = new RegExp(                                                                     // 33
  "^([0-9]|" + [unicodeClass('Mn'), unicodeClass('Mc'), unicodeClass('Nd'),                             // 34
                unicodeClass('Pc')].join('|') + ")+");                                                  // 35
                                                                                                        // 36
                                                                                                        // 37
// See ECMA-262 spec, 3rd edition, Section 7.8.3                                                        // 38
var rHexLiteral = /^0[xX][0-9a-fA-F]+(?!\w)/;                                                           // 39
var rDecLiteral =                                                                                       // 40
      /^(((0|[1-9][0-9]*)(\.[0-9]*)?)|\.[0-9]+)([Ee][+-]?[0-9]+)?(?!\w)/;                               // 41
                                                                                                        // 42
// Section 7.8.4                                                                                        // 43
var rStringQuote = /^["']/;                                                                             // 44
// Match one or more characters besides quotes, backslashes, or line ends                               // 45
var rStringMiddle = /^(?=.)[^"'\\]+?((?!.)|(?=["'\\]))/;                                                // 46
// Match one escape sequence, including the backslash.                                                  // 47
var rEscapeSequence =                                                                                   // 48
      /^\\(['"\\bfnrtv]|0(?![0-9])|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|(?=.)[^ux0-9])/;                     // 49
// Match one ES5 line continuation                                                                      // 50
var rLineContinuation =                                                                                 // 51
      /^\\(\r\n|[\u000A\u000D\u2028\u2029])/;                                                           // 52
                                                                                                        // 53
                                                                                                        // 54
parseNumber = function (scanner) {                                                                      // 55
  var startPos = scanner.pos;                                                                           // 56
                                                                                                        // 57
  var isNegative = false;                                                                               // 58
  if (scanner.peek() === '-') {                                                                         // 59
    scanner.pos++;                                                                                      // 60
    isNegative = true;                                                                                  // 61
  }                                                                                                     // 62
  // Note that we allow `"-0xa"`, unlike `Number(...)`.                                                 // 63
                                                                                                        // 64
  var rest = scanner.rest();                                                                            // 65
  var match = rDecLiteral.exec(rest) || rHexLiteral.exec(rest);                                         // 66
  if (! match) {                                                                                        // 67
    scanner.pos = startPos;                                                                             // 68
    return null;                                                                                        // 69
  }                                                                                                     // 70
  var matchText = match[0];                                                                             // 71
  scanner.pos += matchText.length;                                                                      // 72
                                                                                                        // 73
  var text = (isNegative ? '-' : '') + matchText;                                                       // 74
  var value = Number(matchText);                                                                        // 75
  value = (isNegative ? -value : value);                                                                // 76
  return { text: text, value: value };                                                                  // 77
};                                                                                                      // 78
                                                                                                        // 79
parseIdentifierName = function (scanner) {                                                              // 80
  var startPos = scanner.pos;                                                                           // 81
  var rest = scanner.rest();                                                                            // 82
  var match = rIdentifierPrefix.exec(rest);                                                             // 83
  if (! match)                                                                                          // 84
    return null;                                                                                        // 85
  scanner.pos += match[0].length;                                                                       // 86
  rest = scanner.rest();                                                                                // 87
  var foundMore = true;                                                                                 // 88
                                                                                                        // 89
  while (foundMore) {                                                                                   // 90
    foundMore = false;                                                                                  // 91
                                                                                                        // 92
    match = rIdentifierMiddle.exec(rest);                                                               // 93
    if (match) {                                                                                        // 94
      foundMore = true;                                                                                 // 95
      scanner.pos += match[0].length;                                                                   // 96
      rest = scanner.rest();                                                                            // 97
    }                                                                                                   // 98
                                                                                                        // 99
    match = rIdentifierPrefix.exec(rest);                                                               // 100
    if (match) {                                                                                        // 101
      foundMore = true;                                                                                 // 102
      scanner.pos += match[0].length;                                                                   // 103
      rest = scanner.rest();                                                                            // 104
    }                                                                                                   // 105
  }                                                                                                     // 106
                                                                                                        // 107
  return scanner.input.substring(startPos, scanner.pos);                                                // 108
};                                                                                                      // 109
                                                                                                        // 110
parseStringLiteral = function (scanner) {                                                               // 111
  var startPos = scanner.pos;                                                                           // 112
  var rest = scanner.rest();                                                                            // 113
  var match = rStringQuote.exec(rest);                                                                  // 114
  if (! match)                                                                                          // 115
    return null;                                                                                        // 116
                                                                                                        // 117
  var quote = match[0];                                                                                 // 118
  scanner.pos++;                                                                                        // 119
  rest = scanner.rest();                                                                                // 120
                                                                                                        // 121
  var jsonLiteral = '"';                                                                                // 122
                                                                                                        // 123
  while (match) {                                                                                       // 124
    match = rStringMiddle.exec(rest);                                                                   // 125
    if (match) {                                                                                        // 126
      jsonLiteral += match[0];                                                                          // 127
    } else {                                                                                            // 128
      match = rEscapeSequence.exec(rest);                                                               // 129
      if (match) {                                                                                      // 130
        var esc = match[0];                                                                             // 131
        // Convert all string escapes to JSON-compatible string escapes, so we                          // 132
        // can use JSON.parse for some of the work.  JSON strings are not the                           // 133
        // same as JS strings.  They don't support `\0`, `\v`, `\'`, or hex                             // 134
        // escapes.                                                                                     // 135
        if (esc === '\\0')                                                                              // 136
          jsonLiteral += '\\u0000';                                                                     // 137
        else if (esc === '\\v')                                                                         // 138
          // Note: IE 8 doesn't correctly parse '\v' in JavaScript.                                     // 139
          jsonLiteral += '\\u000b';                                                                     // 140
        else if (esc.charAt(1) === 'x')                                                                 // 141
          jsonLiteral += '\\u00' + esc.slice(2);                                                        // 142
        else if (esc === '\\\'')                                                                        // 143
          jsonLiteral += "'";                                                                           // 144
        else                                                                                            // 145
          jsonLiteral += esc;                                                                           // 146
      } else {                                                                                          // 147
        match = rLineContinuation.exec(rest);                                                           // 148
        if (! match) {                                                                                  // 149
          match = rStringQuote.exec(rest);                                                              // 150
          if (match) {                                                                                  // 151
            var c = match[0];                                                                           // 152
            if (c !== quote) {                                                                          // 153
              if (c === '"')                                                                            // 154
                jsonLiteral += '\\';                                                                    // 155
              jsonLiteral += c;                                                                         // 156
            }                                                                                           // 157
          }                                                                                             // 158
        }                                                                                               // 159
      }                                                                                                 // 160
    }                                                                                                   // 161
    if (match) {                                                                                        // 162
      scanner.pos += match[0].length;                                                                   // 163
      rest = scanner.rest();                                                                            // 164
      if (match[0] === quote)                                                                           // 165
        break;                                                                                          // 166
    }                                                                                                   // 167
  }                                                                                                     // 168
                                                                                                        // 169
  if (match[0] !== quote)                                                                               // 170
    scanner.fatal("Unterminated string literal");                                                       // 171
                                                                                                        // 172
  jsonLiteral += '"';                                                                                   // 173
  var text = scanner.input.substring(startPos, scanner.pos);                                            // 174
  var value = JSON.parse(jsonLiteral);                                                                  // 175
  return { text: text, value: value };                                                                  // 176
};                                                                                                      // 177
                                                                                                        // 178
// expose for testing                                                                                   // 179
Spacebars._$ = {                                                                                        // 180
  parseNumber: parseNumber,                                                                             // 181
  parseIdentifierName: parseIdentifierName,                                                             // 182
  parseStringLiteral: parseStringLiteral                                                                // 183
};                                                                                                      // 184
                                                                                                        // 185
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/spacebars-compiler/tojs.js                                                                  //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
// Turns any JSONable value into a JavaScript literal.                                                  // 2
toJSLiteral = function (obj) {                                                                          // 3
  // See <http://timelessrepo.com/json-isnt-a-javascript-subset> for `\u2028\u2029`.                    // 4
  // Also escape Unicode surrogates.                                                                    // 5
  return (JSON.stringify(obj)                                                                           // 6
          .replace(/[\u2028\u2029\ud800-\udfff]/g, function (c) {                                       // 7
            return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);                            // 8
          }));                                                                                          // 9
};                                                                                                      // 10
                                                                                                        // 11
                                                                                                        // 12
                                                                                                        // 13
var jsReservedWordSet = (function (set) {                                                               // 14
  _.each("abstract else instanceof super boolean enum int switch break export interface synchronized byte extends let this case false long throw catch final native throws char finally new transient class float null true const for package try continue function private typeof debugger goto protected var default if public void delete implements return volatile do import short while double in static with".split(' '), function (w) {
    set[w] = 1;                                                                                         // 16
  });                                                                                                   // 17
  return set;                                                                                           // 18
})({});                                                                                                 // 19
                                                                                                        // 20
toObjectLiteralKey = function (k) {                                                                     // 21
  if (/^[a-zA-Z$_][a-zA-Z$0-9_]*$/.test(k) && jsReservedWordSet[k] !== 1)                               // 22
    return k;                                                                                           // 23
  return toJSLiteral(k);                                                                                // 24
};                                                                                                      // 25
                                                                                                        // 26
// This method is generic, i.e. it can be transplanted to non-Tags                                      // 27
// and it will still work by accessing `this.tagName`, `this.attrs`,                                    // 28
// and `this.children`.  It's ok if `this.attrs` has content that                                       // 29
// isn't allowed in an attribute (this feature is used by                                               // 30
// HTMLTools.Special.prototype.toJS).                                                                   // 31
HTML.Tag.prototype.toJS = function (options) {                                                          // 32
  var argStrs = [];                                                                                     // 33
  if (this.attrs) {                                                                                     // 34
    var kvStrs = [];                                                                                    // 35
    for (var k in this.attrs) {                                                                         // 36
      if (! HTML.isNully(this.attrs[k]))                                                                // 37
        kvStrs.push(toObjectLiteralKey(k) + ': ' +                                                      // 38
                    HTML.toJS(this.attrs[k], options));                                                 // 39
    }                                                                                                   // 40
    if (kvStrs.length)                                                                                  // 41
      argStrs.push('{' + kvStrs.join(', ') + '}');                                                      // 42
  }                                                                                                     // 43
                                                                                                        // 44
  for (var i = 0; i < this.children.length; i++) {                                                      // 45
    argStrs.push(HTML.toJS(this.children[i], options));                                                 // 46
  }                                                                                                     // 47
                                                                                                        // 48
  var tagName = this.tagName;                                                                           // 49
  var tagSymbol;                                                                                        // 50
  if (! (this instanceof HTML.Tag))                                                                     // 51
    // a CharRef or Comment, say                                                                        // 52
    tagSymbol = (tagName.indexOf('.') >= 0 ? tagName : 'HTML.' + tagName);                              // 53
  else if (! HTML.isTagEnsured(tagName))                                                                // 54
    tagSymbol = 'HTML.getTag(' + toJSLiteral(tagName) + ')';                                            // 55
  else                                                                                                  // 56
    tagSymbol = 'HTML.' + HTML.getSymbolName(tagName);                                                  // 57
                                                                                                        // 58
  return tagSymbol + '(' + argStrs.join(', ') + ')';                                                    // 59
};                                                                                                      // 60
                                                                                                        // 61
HTML.CharRef.prototype.toJS = function (options) {                                                      // 62
  return HTML.Tag.prototype.toJS.call({tagName: "CharRef",                                              // 63
                                       attrs: {html: this.html,                                         // 64
                                               str: this.str},                                          // 65
                                       children: []},                                                   // 66
                                      options);                                                         // 67
};                                                                                                      // 68
                                                                                                        // 69
HTML.Comment.prototype.toJS = function (options) {                                                      // 70
  return HTML.Tag.prototype.toJS.call({tagName: "Comment",                                              // 71
                                       attrs: null,                                                     // 72
                                       children: [this.value]},                                         // 73
                                      options);                                                         // 74
};                                                                                                      // 75
                                                                                                        // 76
HTML.Raw.prototype.toJS = function (options) {                                                          // 77
  return HTML.Tag.prototype.toJS.call({tagName: "Raw",                                                  // 78
                                       attrs: null,                                                     // 79
                                       children: [this.value]},                                         // 80
                                      options);                                                         // 81
};                                                                                                      // 82
                                                                                                        // 83
HTML.EmitCode.prototype.toJS = function (options) {                                                     // 84
  return this.value;                                                                                    // 85
};                                                                                                      // 86
                                                                                                        // 87
HTML.toJS = function (node, options) {                                                                  // 88
  if (node == null) {                                                                                   // 89
    // null or undefined                                                                                // 90
    return 'null';                                                                                      // 91
  } else if ((typeof node === 'string') || (typeof node === 'boolean') || (typeof node === 'number')) { // 92
    // string (or something that will be rendered as a string)                                          // 93
    return toJSLiteral(node);                                                                           // 94
  } else if (node instanceof Array) {                                                                   // 95
    // array                                                                                            // 96
    var parts = [];                                                                                     // 97
    for (var i = 0; i < node.length; i++)                                                               // 98
      parts.push(HTML.toJS(node[i], options));                                                          // 99
    return '[' + parts.join(', ') + ']';                                                                // 100
  } else if (node.toJS) {                                                                               // 101
    // Tag or something else                                                                            // 102
    return node.toJS(options);                                                                          // 103
  } else {                                                                                              // 104
    throw new Error("Expected tag, string, array, null, undefined, or " +                               // 105
                    "object with a toJS method; found: " + node);                                       // 106
  }                                                                                                     // 107
};                                                                                                      // 108
                                                                                                        // 109
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/spacebars-compiler/templatetag.js                                                           //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
// A TemplateTag is the result of parsing a single `{{...}}` tag.                                       // 1
//                                                                                                      // 2
// The `.type` of a TemplateTag is one of:                                                              // 3
//                                                                                                      // 4
// - `"DOUBLE"` - `{{foo}}`                                                                             // 5
// - `"TRIPLE"` - `{{{foo}}}`                                                                           // 6
// - `"COMMENT"` - `{{! foo}}`                                                                          // 7
// - `"INCLUSION"` - `{{> foo}}`                                                                        // 8
// - `"BLOCKOPEN"` - `{{#foo}}`                                                                         // 9
// - `"BLOCKCLOSE"` - `{{/foo}}`                                                                        // 10
// - `"ELSE"` - `{{else}}`                                                                              // 11
//                                                                                                      // 12
// Besides `type`, the mandatory properties of a TemplateTag are:                                       // 13
//                                                                                                      // 14
// - `path` - An array of one or more strings.  The path of `{{foo.bar}}`                               // 15
//   is `["foo", "bar"]`.  Applies to DOUBLE, TRIPLE, INCLUSION, BLOCKOPEN,                             // 16
//   and BLOCKCLOSE.                                                                                    // 17
//                                                                                                      // 18
// - `args` - An array of zero or more argument specs.  An argument spec                                // 19
//   is a two or three element array, consisting of a type, value, and                                  // 20
//   optional keyword name.  For example, the `args` of `{{foo "bar" x=3}}`                             // 21
//   are `[["STRING", "bar"], ["NUMBER", 3, "x"]]`.  Applies to DOUBLE,                                 // 22
//   TRIPLE, INCLUSION, and BLOCKOPEN.                                                                  // 23
//                                                                                                      // 24
// - `value` - For COMMENT tags, a string of the comment's text.                                        // 25
//                                                                                                      // 26
// These additional are typically set during parsing:                                                   // 27
//                                                                                                      // 28
// - `position` - The HTMLTools.TEMPLATE_TAG_POSITION specifying at what sort                           // 29
//   of site the TemplateTag was encountered (e.g. at element level or as                               // 30
//   part of an attribute value). Its absence implies                                                   // 31
//   TEMPLATE_TAG_POSITION.ELEMENT.                                                                     // 32
//                                                                                                      // 33
// - `content` and `elseContent` - When a BLOCKOPEN tag's contents are                                  // 34
//   parsed, they are put here.  `elseContent` will only be present if                                  // 35
//   an `{{else}}` was found.                                                                           // 36
                                                                                                        // 37
var TEMPLATE_TAG_POSITION = HTMLTools.TEMPLATE_TAG_POSITION;                                            // 38
                                                                                                        // 39
TemplateTag = Spacebars.TemplateTag = function () {};                                                   // 40
                                                                                                        // 41
var makeStacheTagStartRegex = function (r) {                                                            // 42
  return new RegExp(r.source + /(?![{>!#/])/.source,                                                    // 43
                    r.ignoreCase ? 'i' : '');                                                           // 44
};                                                                                                      // 45
                                                                                                        // 46
var starts = {                                                                                          // 47
  ELSE: makeStacheTagStartRegex(/^\{\{\s*else(?=[\s}])/i),                                              // 48
  DOUBLE: makeStacheTagStartRegex(/^\{\{\s*(?!\s)/),                                                    // 49
  TRIPLE: makeStacheTagStartRegex(/^\{\{\{\s*(?!\s)/),                                                  // 50
  BLOCKCOMMENT: makeStacheTagStartRegex(/^\{\{\s*!--/),                                                 // 51
  COMMENT: makeStacheTagStartRegex(/^\{\{\s*!/),                                                        // 52
  INCLUSION: makeStacheTagStartRegex(/^\{\{\s*>\s*(?!\s)/),                                             // 53
  BLOCKOPEN: makeStacheTagStartRegex(/^\{\{\s*#\s*(?!\s)/),                                             // 54
  BLOCKCLOSE: makeStacheTagStartRegex(/^\{\{\s*\/\s*(?!\s)/)                                            // 55
};                                                                                                      // 56
                                                                                                        // 57
var ends = {                                                                                            // 58
  DOUBLE: /^\s*\}\}/,                                                                                   // 59
  TRIPLE: /^\s*\}\}\}/                                                                                  // 60
};                                                                                                      // 61
                                                                                                        // 62
// Parse a tag from the provided scanner or string.  If the input                                       // 63
// doesn't start with `{{`, returns null.  Otherwise, either succeeds                                   // 64
// and returns a Spacebars.TemplateTag, or throws an error (using                                       // 65
// `scanner.fatal` if a scanner is provided).                                                           // 66
TemplateTag.parse = function (scannerOrString) {                                                        // 67
  var scanner = scannerOrString;                                                                        // 68
  if (typeof scanner === 'string')                                                                      // 69
    scanner = new HTMLTools.Scanner(scannerOrString);                                                   // 70
                                                                                                        // 71
  if (! (scanner.peek() === '{' &&                                                                      // 72
         (scanner.rest()).slice(0, 2) === '{{'))                                                        // 73
    return null;                                                                                        // 74
                                                                                                        // 75
  var run = function (regex) {                                                                          // 76
    // regex is assumed to start with `^`                                                               // 77
    var result = regex.exec(scanner.rest());                                                            // 78
    if (! result)                                                                                       // 79
      return null;                                                                                      // 80
    var ret = result[0];                                                                                // 81
    scanner.pos += ret.length;                                                                          // 82
    return ret;                                                                                         // 83
  };                                                                                                    // 84
                                                                                                        // 85
  var advance = function (amount) {                                                                     // 86
    scanner.pos += amount;                                                                              // 87
  };                                                                                                    // 88
                                                                                                        // 89
  var scanIdentifier = function (isFirstInPath) {                                                       // 90
    var id = parseIdentifierName(scanner);                                                              // 91
    if (! id)                                                                                           // 92
      expected('IDENTIFIER');                                                                           // 93
    if (isFirstInPath &&                                                                                // 94
        (id === 'null' || id === 'true' || id === 'false'))                                             // 95
      scanner.fatal("Can't use null, true, or false, as an identifier at start of path");               // 96
                                                                                                        // 97
    return id;                                                                                          // 98
  };                                                                                                    // 99
                                                                                                        // 100
  var scanPath = function () {                                                                          // 101
    var segments = [];                                                                                  // 102
                                                                                                        // 103
    // handle initial `.`, `..`, `./`, `../`, `../..`, `../../`, etc                                    // 104
    var dots;                                                                                           // 105
    if ((dots = run(/^[\.\/]+/))) {                                                                     // 106
      var ancestorStr = '.'; // eg `../../..` maps to `....`                                            // 107
      var endsWithSlash = /\/$/.test(dots);                                                             // 108
                                                                                                        // 109
      if (endsWithSlash)                                                                                // 110
        dots = dots.slice(0, -1);                                                                       // 111
                                                                                                        // 112
      _.each(dots.split('/'), function(dotClause, index) {                                              // 113
        if (index === 0) {                                                                              // 114
          if (dotClause !== '.' && dotClause !== '..')                                                  // 115
            expected("`.`, `..`, `./` or `../`");                                                       // 116
        } else {                                                                                        // 117
          if (dotClause !== '..')                                                                       // 118
            expected("`..` or `../`");                                                                  // 119
        }                                                                                               // 120
                                                                                                        // 121
        if (dotClause === '..')                                                                         // 122
          ancestorStr += '.';                                                                           // 123
      });                                                                                               // 124
                                                                                                        // 125
      segments.push(ancestorStr);                                                                       // 126
                                                                                                        // 127
      if (!endsWithSlash)                                                                               // 128
        return segments;                                                                                // 129
    }                                                                                                   // 130
                                                                                                        // 131
    while (true) {                                                                                      // 132
      // scan a path segment                                                                            // 133
                                                                                                        // 134
      if (run(/^\[/)) {                                                                                 // 135
        var seg = run(/^[\s\S]*?\]/);                                                                   // 136
        if (! seg)                                                                                      // 137
          error("Unterminated path segment");                                                           // 138
        seg = seg.slice(0, -1);                                                                         // 139
        if (! seg && ! segments.length)                                                                 // 140
          error("Path can't start with empty string");                                                  // 141
        segments.push(seg);                                                                             // 142
      } else {                                                                                          // 143
        var id = scanIdentifier(! segments.length);                                                     // 144
        if (id === 'this') {                                                                            // 145
          if (! segments.length) {                                                                      // 146
            // initial `this`                                                                           // 147
            segments.push('.');                                                                         // 148
          } else {                                                                                      // 149
            error("Can only use `this` at the beginning of a path.\nInstead of `foo.this` or `../this`, just write `foo` or `..`.");
          }                                                                                             // 151
        } else {                                                                                        // 152
          segments.push(id);                                                                            // 153
        }                                                                                               // 154
      }                                                                                                 // 155
                                                                                                        // 156
      var sep = run(/^[\.\/]/);                                                                         // 157
      if (! sep)                                                                                        // 158
        break;                                                                                          // 159
    }                                                                                                   // 160
                                                                                                        // 161
    return segments;                                                                                    // 162
  };                                                                                                    // 163
                                                                                                        // 164
  // scan the keyword portion of a keyword argument                                                     // 165
  // (the "foo" portion in "foo=bar").                                                                  // 166
  // Result is either the keyword matched, or null                                                      // 167
  // if we're not at a keyword argument position.                                                       // 168
  var scanArgKeyword = function () {                                                                    // 169
    var match = /^([^\{\}\(\)\>#=\s]+)\s*=\s*/.exec(scanner.rest());                                    // 170
    if (match) {                                                                                        // 171
      scanner.pos += match[0].length;                                                                   // 172
      return match[1];                                                                                  // 173
    } else {                                                                                            // 174
      return null;                                                                                      // 175
    }                                                                                                   // 176
  };                                                                                                    // 177
                                                                                                        // 178
  // scan an argument; succeeds or errors.                                                              // 179
  // Result is an array of two or three items:                                                          // 180
  // type , value, and (indicating a keyword argument)                                                  // 181
  // keyword name.                                                                                      // 182
  var scanArg = function () {                                                                           // 183
    var keyword = scanArgKeyword(); // null if not parsing a kwarg                                      // 184
    var value = scanArgValue();                                                                         // 185
    return keyword ? value.concat(keyword) : value;                                                     // 186
  };                                                                                                    // 187
                                                                                                        // 188
  // scan an argument value (for keyword or positional arguments);                                      // 189
  // succeeds or errors.  Result is an array of type, value.                                            // 190
  var scanArgValue = function () {                                                                      // 191
    var startPos = scanner.pos;                                                                         // 192
    var result;                                                                                         // 193
    if ((result = parseNumber(scanner))) {                                                              // 194
      return ['NUMBER', result.value];                                                                  // 195
    } else if ((result = parseStringLiteral(scanner))) {                                                // 196
      return ['STRING', result.value];                                                                  // 197
    } else if (/^[\.\[]/.test(scanner.peek())) {                                                        // 198
      return ['PATH', scanPath()];                                                                      // 199
    } else if ((result = parseIdentifierName(scanner))) {                                               // 200
      var id = result;                                                                                  // 201
      if (id === 'null') {                                                                              // 202
        return ['NULL', null];                                                                          // 203
      } else if (id === 'true' || id === 'false') {                                                     // 204
        return ['BOOLEAN', id === 'true'];                                                              // 205
      } else {                                                                                          // 206
        scanner.pos = startPos; // unconsume `id`                                                       // 207
        return ['PATH', scanPath()];                                                                    // 208
      }                                                                                                 // 209
    } else {                                                                                            // 210
      expected('identifier, number, string, boolean, or null');                                         // 211
    }                                                                                                   // 212
  };                                                                                                    // 213
                                                                                                        // 214
  var type;                                                                                             // 215
                                                                                                        // 216
  var error = function (msg) {                                                                          // 217
    scanner.fatal(msg);                                                                                 // 218
  };                                                                                                    // 219
                                                                                                        // 220
  var expected = function (what) {                                                                      // 221
    error('Expected ' + what);                                                                          // 222
  };                                                                                                    // 223
                                                                                                        // 224
  // must do ELSE first; order of others doesn't matter                                                 // 225
                                                                                                        // 226
  if (run(starts.ELSE)) type = 'ELSE';                                                                  // 227
  else if (run(starts.DOUBLE)) type = 'DOUBLE';                                                         // 228
  else if (run(starts.TRIPLE)) type = 'TRIPLE';                                                         // 229
  else if (run(starts.BLOCKCOMMENT)) type = 'BLOCKCOMMENT';                                             // 230
  else if (run(starts.COMMENT)) type = 'COMMENT';                                                       // 231
  else if (run(starts.INCLUSION)) type = 'INCLUSION';                                                   // 232
  else if (run(starts.BLOCKOPEN)) type = 'BLOCKOPEN';                                                   // 233
  else if (run(starts.BLOCKCLOSE)) type = 'BLOCKCLOSE';                                                 // 234
  else                                                                                                  // 235
    error('Unknown stache tag');                                                                        // 236
                                                                                                        // 237
  var tag = new TemplateTag;                                                                            // 238
  tag.type = type;                                                                                      // 239
                                                                                                        // 240
  if (type === 'BLOCKCOMMENT') {                                                                        // 241
    var result = run(/^[\s\S]*?--\s*?\}\}/);                                                            // 242
    if (! result)                                                                                       // 243
      error("Unclosed block comment");                                                                  // 244
    tag.value = result.slice(0, result.lastIndexOf('--'));                                              // 245
  } else if (type === 'COMMENT') {                                                                      // 246
    var result = run(/^[\s\S]*?\}\}/);                                                                  // 247
    if (! result)                                                                                       // 248
      error("Unclosed comment");                                                                        // 249
    tag.value = result.slice(0, -2);                                                                    // 250
  } else if (type === 'BLOCKCLOSE') {                                                                   // 251
    tag.path = scanPath();                                                                              // 252
    if (! run(ends.DOUBLE))                                                                             // 253
      expected('`}}`');                                                                                 // 254
  } else if (type === 'ELSE') {                                                                         // 255
    if (! run(ends.DOUBLE))                                                                             // 256
      expected('`}}`');                                                                                 // 257
  } else {                                                                                              // 258
    // DOUBLE, TRIPLE, BLOCKOPEN, INCLUSION                                                             // 259
    tag.path = scanPath();                                                                              // 260
    tag.args = [];                                                                                      // 261
    var foundKwArg = false;                                                                             // 262
    while (true) {                                                                                      // 263
      run(/^\s*/);                                                                                      // 264
      if (type === 'TRIPLE') {                                                                          // 265
        if (run(ends.TRIPLE))                                                                           // 266
          break;                                                                                        // 267
        else if (scanner.peek() === '}')                                                                // 268
          expected('`}}}`');                                                                            // 269
      } else {                                                                                          // 270
        if (run(ends.DOUBLE))                                                                           // 271
          break;                                                                                        // 272
        else if (scanner.peek() === '}')                                                                // 273
          expected('`}}`');                                                                             // 274
      }                                                                                                 // 275
      var newArg = scanArg();                                                                           // 276
      if (newArg.length === 3) {                                                                        // 277
        foundKwArg = true;                                                                              // 278
      } else {                                                                                          // 279
        if (foundKwArg)                                                                                 // 280
          error("Can't have a non-keyword argument after a keyword argument");                          // 281
      }                                                                                                 // 282
      tag.args.push(newArg);                                                                            // 283
                                                                                                        // 284
      if (run(/^(?=[\s}])/) !== '')                                                                     // 285
        expected('space');                                                                              // 286
    }                                                                                                   // 287
  }                                                                                                     // 288
                                                                                                        // 289
  return tag;                                                                                           // 290
};                                                                                                      // 291
                                                                                                        // 292
// Returns a Spacebars.TemplateTag parsed from `scanner`, leaving scanner                               // 293
// at its original position.                                                                            // 294
//                                                                                                      // 295
// An error will still be thrown if there is not a valid template tag at                                // 296
// the current position.                                                                                // 297
TemplateTag.peek = function (scanner) {                                                                 // 298
  var startPos = scanner.pos;                                                                           // 299
  var result = TemplateTag.parse(scanner);                                                              // 300
  scanner.pos = startPos;                                                                               // 301
  return result;                                                                                        // 302
};                                                                                                      // 303
                                                                                                        // 304
// Like `TemplateTag.parse`, but in the case of blocks, parse the complete                              // 305
// `{{#foo}}...{{/foo}}` with `content` and possible `elseContent`, rather                              // 306
// than just the BLOCKOPEN tag.                                                                         // 307
//                                                                                                      // 308
// In addition:                                                                                         // 309
//                                                                                                      // 310
// - Throws an error if `{{else}}` or `{{/foo}}` tag is encountered.                                    // 311
//                                                                                                      // 312
// - Returns `null` for a COMMENT.  (This case is distinguishable from                                  // 313
//   parsing no tag by the fact that the scanner is advanced.)                                          // 314
//                                                                                                      // 315
// - Takes an HTMLTools.TEMPLATE_TAG_POSITION `position` and sets it as the                             // 316
//   TemplateTag's `.position` property.                                                                // 317
//                                                                                                      // 318
// - Validates the tag's well-formedness and legality at in its position.                               // 319
TemplateTag.parseCompleteTag = function (scannerOrString, position) {                                   // 320
  var scanner = scannerOrString;                                                                        // 321
  if (typeof scanner === 'string')                                                                      // 322
    scanner = new HTMLTools.Scanner(scannerOrString);                                                   // 323
                                                                                                        // 324
  var startPos = scanner.pos; // for error messages                                                     // 325
  var result = TemplateTag.parse(scannerOrString);                                                      // 326
  if (! result)                                                                                         // 327
    return result;                                                                                      // 328
                                                                                                        // 329
  if (result.type === 'BLOCKCOMMENT')                                                                   // 330
    return null;                                                                                        // 331
                                                                                                        // 332
  if (result.type === 'COMMENT')                                                                        // 333
    return null;                                                                                        // 334
                                                                                                        // 335
  if (result.type === 'ELSE')                                                                           // 336
    scanner.fatal("Unexpected {{else}}");                                                               // 337
                                                                                                        // 338
  if (result.type === 'BLOCKCLOSE')                                                                     // 339
    scanner.fatal("Unexpected closing template tag");                                                   // 340
                                                                                                        // 341
  position = (position || TEMPLATE_TAG_POSITION.ELEMENT);                                               // 342
  if (position !== TEMPLATE_TAG_POSITION.ELEMENT)                                                       // 343
    result.position = position;                                                                         // 344
                                                                                                        // 345
  if (result.type === 'BLOCKOPEN') {                                                                    // 346
    // parse block contents                                                                             // 347
                                                                                                        // 348
    // Construct a string version of `.path` for comparing start and                                    // 349
    // end tags.  For example, `foo/[0]` was parsed into `["foo", "0"]`                                 // 350
    // and now becomes `foo,0`.  This form may also show up in error                                    // 351
    // messages.                                                                                        // 352
    var blockName = result.path.join(',');                                                              // 353
                                                                                                        // 354
    var textMode = null;                                                                                // 355
      if (blockName === 'markdown' ||                                                                   // 356
          position === TEMPLATE_TAG_POSITION.IN_RAWTEXT) {                                              // 357
        textMode = HTML.TEXTMODE.STRING;                                                                // 358
      } else if (position === TEMPLATE_TAG_POSITION.IN_RCDATA ||                                        // 359
                 position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {                                     // 360
        textMode = HTML.TEXTMODE.RCDATA;                                                                // 361
      }                                                                                                 // 362
      var parserOptions = {                                                                             // 363
        getSpecialTag: TemplateTag.parseCompleteTag,                                                    // 364
        shouldStop: isAtBlockCloseOrElse,                                                               // 365
        textMode: textMode                                                                              // 366
      };                                                                                                // 367
    result.content = HTMLTools.parseFragment(scanner, parserOptions);                                   // 368
                                                                                                        // 369
    if (scanner.rest().slice(0, 2) !== '{{')                                                            // 370
      scanner.fatal("Expected {{else}} or block close for " + blockName);                               // 371
                                                                                                        // 372
    var lastPos = scanner.pos; // save for error messages                                               // 373
    var tmplTag = TemplateTag.parse(scanner); // {{else}} or {{/foo}}                                   // 374
                                                                                                        // 375
    if (tmplTag.type === 'ELSE') {                                                                      // 376
      // parse {{else}} and content up to close tag                                                     // 377
      result.elseContent = HTMLTools.parseFragment(scanner, parserOptions);                             // 378
                                                                                                        // 379
      if (scanner.rest().slice(0, 2) !== '{{')                                                          // 380
        scanner.fatal("Expected block close for " + blockName);                                         // 381
                                                                                                        // 382
      lastPos = scanner.pos;                                                                            // 383
      tmplTag = TemplateTag.parse(scanner);                                                             // 384
    }                                                                                                   // 385
                                                                                                        // 386
    if (tmplTag.type === 'BLOCKCLOSE') {                                                                // 387
      var blockName2 = tmplTag.path.join(',');                                                          // 388
      if (blockName !== blockName2) {                                                                   // 389
        scanner.pos = lastPos;                                                                          // 390
        scanner.fatal('Expected tag to close ' + blockName + ', found ' +                               // 391
                      blockName2);                                                                      // 392
      }                                                                                                 // 393
    } else {                                                                                            // 394
      scanner.pos = lastPos;                                                                            // 395
      scanner.fatal('Expected tag to close ' + blockName + ', found ' +                                 // 396
                    tmplTag.type);                                                                      // 397
    }                                                                                                   // 398
  }                                                                                                     // 399
                                                                                                        // 400
  var finalPos = scanner.pos;                                                                           // 401
  scanner.pos = startPos;                                                                               // 402
  validateTag(result, scanner);                                                                         // 403
  scanner.pos = finalPos;                                                                               // 404
                                                                                                        // 405
  return result;                                                                                        // 406
};                                                                                                      // 407
                                                                                                        // 408
var isAtBlockCloseOrElse = function (scanner) {                                                         // 409
  // Detect `{{else}}` or `{{/foo}}`.                                                                   // 410
  //                                                                                                    // 411
  // We do as much work ourselves before deferring to `TemplateTag.peek`,                               // 412
  // for efficiency (we're called for every input token) and to be                                      // 413
  // less obtrusive, because `TemplateTag.peek` will throw an error if it                               // 414
  // sees `{{` followed by a malformed tag.                                                             // 415
  var rest, type;                                                                                       // 416
  return (scanner.peek() === '{' &&                                                                     // 417
          (rest = scanner.rest()).slice(0, 2) === '{{' &&                                               // 418
          /^\{\{\s*(\/|else\b)/.test(rest) &&                                                           // 419
          (type = TemplateTag.peek(scanner).type) &&                                                    // 420
          (type === 'BLOCKCLOSE' || type === 'ELSE'));                                                  // 421
};                                                                                                      // 422
                                                                                                        // 423
// Validate that `templateTag` is correctly formed and legal for its                                    // 424
// HTML position.  Use `scanner` to report errors. On success, does                                     // 425
// nothing.                                                                                             // 426
var validateTag = function (ttag, scanner) {                                                            // 427
                                                                                                        // 428
  if (ttag.type === 'INCLUSION' || ttag.type === 'BLOCKOPEN') {                                         // 429
    var args = ttag.args;                                                                               // 430
    if (args.length > 1 && args[0].length === 2 && args[0][0] !== 'PATH') {                             // 431
      // we have a positional argument that is not a PATH followed by                                   // 432
      // other arguments                                                                                // 433
      scanner.fatal("First argument must be a function, to be called on the rest of the arguments; found " + args[0][0]);
    }                                                                                                   // 435
  }                                                                                                     // 436
                                                                                                        // 437
  var position = ttag.position || TEMPLATE_TAG_POSITION.ELEMENT;                                        // 438
  if (position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {                                                // 439
    if (ttag.type === 'DOUBLE') {                                                                       // 440
      return;                                                                                           // 441
    } else if (ttag.type === 'BLOCKOPEN') {                                                             // 442
      var path = ttag.path;                                                                             // 443
      var path0 = path[0];                                                                              // 444
      if (! (path.length === 1 && (path0 === 'if' ||                                                    // 445
                                   path0 === 'unless' ||                                                // 446
                                   path0 === 'with' ||                                                  // 447
                                   path0 === 'each'))) {                                                // 448
        scanner.fatal("Custom block helpers are not allowed in an HTML attribute, only built-in ones like #each and #if");
      }                                                                                                 // 450
    } else {                                                                                            // 451
      scanner.fatal(ttag.type + " template tag is not allowed in an HTML attribute");                   // 452
    }                                                                                                   // 453
  } else if (position === TEMPLATE_TAG_POSITION.IN_START_TAG) {                                         // 454
    if (! (ttag.type === 'DOUBLE')) {                                                                   // 455
      scanner.fatal("Reactive HTML attributes must either have a constant name or consist of a single {{helper}} providing a dictionary of names and values.  A template tag of type " + ttag.type + " is not allowed here.");
    }                                                                                                   // 457
    if (scanner.peek() === '=') {                                                                       // 458
      scanner.fatal("Template tags are not allowed in attribute names, only in attribute values or in the form of a single {{helper}} that evaluates to a dictionary of name=value pairs.");
    }                                                                                                   // 460
  }                                                                                                     // 461
                                                                                                        // 462
};                                                                                                      // 463
                                                                                                        // 464
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/spacebars-compiler/spacebars-compiler.js                                                    //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
                                                                                                        // 1
                                                                                                        // 2
                                                                                                        // 3
Spacebars.parse = function (input) {                                                                    // 4
                                                                                                        // 5
  var tree = HTMLTools.parseFragment(                                                                   // 6
    input,                                                                                              // 7
    { getSpecialTag: TemplateTag.parseCompleteTag });                                                   // 8
                                                                                                        // 9
  return tree;                                                                                          // 10
};                                                                                                      // 11
                                                                                                        // 12
// ============================================================                                         // 13
// Optimizer for optimizing HTMLjs into raw HTML string when                                            // 14
// it doesn't contain template tags.                                                                    // 15
                                                                                                        // 16
var optimize = function (tree) {                                                                        // 17
                                                                                                        // 18
  var pushRawHTML = function (array, html) {                                                            // 19
    var N = array.length;                                                                               // 20
    if (N > 0 && (array[N-1] instanceof HTML.Raw)) {                                                    // 21
      array[N-1] = HTML.Raw(array[N-1].value + html);                                                   // 22
    } else {                                                                                            // 23
      array.push(HTML.Raw(html));                                                                       // 24
    }                                                                                                   // 25
  };                                                                                                    // 26
                                                                                                        // 27
  var isPureChars = function (html) {                                                                   // 28
    return (html.indexOf('&') < 0 && html.indexOf('<') < 0);                                            // 29
  };                                                                                                    // 30
                                                                                                        // 31
  // Returns `null` if no specials are found in the array, so that the                                  // 32
  // parent can perform the actual optimization.  Otherwise, returns                                    // 33
  // an array of parts which have been optimized as much as possible.                                   // 34
  // `forceOptimize` forces the latter case.                                                            // 35
  var optimizeArrayParts = function (array, optimizePartsFunc, forceOptimize) {                         // 36
    var result = null;                                                                                  // 37
    if (forceOptimize)                                                                                  // 38
      result = [];                                                                                      // 39
    for (var i = 0, N = array.length; i < N; i++) {                                                     // 40
      var part = optimizePartsFunc(array[i]);                                                           // 41
      if (part !== null) {                                                                              // 42
        // something special found                                                                      // 43
        if (result === null) {                                                                          // 44
          // This is our first special item.  Stringify the other parts.                                // 45
          result = [];                                                                                  // 46
          for (var j = 0; j < i; j++)                                                                   // 47
            pushRawHTML(result, HTML.toHTML(array[j]));                                                 // 48
        }                                                                                               // 49
        result.push(part);                                                                              // 50
      } else {                                                                                          // 51
        // just plain HTML found                                                                        // 52
        if (result !== null) {                                                                          // 53
          // we've already found something special, so convert this to Raw                              // 54
          pushRawHTML(result, HTML.toHTML(array[i]));                                                   // 55
        }                                                                                               // 56
      }                                                                                                 // 57
    }                                                                                                   // 58
    if (result !== null) {                                                                              // 59
      // clean up unnecessary HTML.Raw wrappers around pure character data                              // 60
      for (var j = 0; j < result.length; j++) {                                                         // 61
        if ((result[j] instanceof HTML.Raw) &&                                                          // 62
            isPureChars(result[j].value))                                                               // 63
          // replace HTML.Raw with simple string                                                        // 64
          result[j] = result[j].value;                                                                  // 65
      }                                                                                                 // 66
    }                                                                                                   // 67
    return result;                                                                                      // 68
  };                                                                                                    // 69
                                                                                                        // 70
  var doesAttributeValueHaveSpecials = function (v) {                                                   // 71
    if (v instanceof HTMLTools.Special)                                                                 // 72
      return true;                                                                                      // 73
    if (typeof v === 'function')                                                                        // 74
      return true;                                                                                      // 75
                                                                                                        // 76
    if (v instanceof Array) {                                                                           // 77
      for (var i = 0; i < v.length; i++)                                                                // 78
        if (doesAttributeValueHaveSpecials(v[i]))                                                       // 79
          return true;                                                                                  // 80
      return false;                                                                                     // 81
    }                                                                                                   // 82
                                                                                                        // 83
    return false;                                                                                       // 84
  };                                                                                                    // 85
                                                                                                        // 86
  var optimizeParts = function (node) {                                                                 // 87
    // If we have nothing special going on, returns `null` (so that the                                 // 88
    // parent can optimize).  Otherwise returns a replacement for `node`                                // 89
    // with optimized parts.                                                                            // 90
    if ((node == null) || (typeof node === 'string') ||                                                 // 91
        (node instanceof HTML.CharRef) || (node instanceof HTML.Comment) ||                             // 92
        (node instanceof HTML.Raw)) {                                                                   // 93
      // not special; let parent decide how whether to optimize                                         // 94
      return null;                                                                                      // 95
    } else if (node instanceof HTML.Tag) {                                                              // 96
      var tagName = node.tagName;                                                                       // 97
      if (tagName === 'textarea' ||                                                                     // 98
          (! (HTML.isKnownElement(tagName) &&                                                           // 99
              ! HTML.isKnownSVGElement(tagName)))) {                                                    // 100
        // optimizing into a TEXTAREA's RCDATA would require being a little                             // 101
        // more clever.  foreign elements like SVG can't be stringified for                             // 102
        // innerHTML.                                                                                   // 103
        return node;                                                                                    // 104
      }                                                                                                 // 105
                                                                                                        // 106
      var mustOptimize = false;                                                                         // 107
                                                                                                        // 108
      // Avoid ever producing HTML containing `<table><tr>...`, because the                             // 109
      // browser will insert a TBODY.  If we just `createElement("table")` and                          // 110
      // `createElement("tr")`, on the other hand, no TBODY is necessary                                // 111
      // (assuming IE 8+).                                                                              // 112
      if (tagName === 'table')                                                                          // 113
        mustOptimize = true;                                                                            // 114
                                                                                                        // 115
      if (node.attrs && ! mustOptimize) {                                                               // 116
        var attrs = node.attrs;                                                                         // 117
        for (var k in attrs) {                                                                          // 118
          if (doesAttributeValueHaveSpecials(attrs[k])) {                                               // 119
            mustOptimize = true;                                                                        // 120
            break;                                                                                      // 121
          }                                                                                             // 122
        }                                                                                               // 123
      }                                                                                                 // 124
                                                                                                        // 125
      var newChildren = optimizeArrayParts(node.children, optimizeParts, mustOptimize);                 // 126
                                                                                                        // 127
      if (newChildren === null)                                                                         // 128
        return null;                                                                                    // 129
                                                                                                        // 130
      var newTag = HTML.getTag(node.tagName).apply(null, newChildren);                                  // 131
      newTag.attrs = node.attrs;                                                                        // 132
                                                                                                        // 133
      return newTag;                                                                                    // 134
                                                                                                        // 135
    } else if (node instanceof Array) {                                                                 // 136
      return optimizeArrayParts(node, optimizeParts);                                                   // 137
    } else {                                                                                            // 138
      return node;                                                                                      // 139
    }                                                                                                   // 140
  };                                                                                                    // 141
                                                                                                        // 142
  var optTree = optimizeParts(tree);                                                                    // 143
  if (optTree !== null)                                                                                 // 144
    // tree was optimized in parts                                                                      // 145
    return optTree;                                                                                     // 146
                                                                                                        // 147
  optTree = HTML.Raw(HTML.toHTML(tree));                                                                // 148
                                                                                                        // 149
  if (isPureChars(optTree.value))                                                                       // 150
    return optTree.value;                                                                               // 151
                                                                                                        // 152
  return optTree;                                                                                       // 153
};                                                                                                      // 154
                                                                                                        // 155
// ============================================================                                         // 156
// Code-generation of template tags                                                                     // 157
                                                                                                        // 158
var builtInBlockHelpers = {                                                                             // 159
  'if': 'UI.If',                                                                                        // 160
  'unless': 'UI.Unless',                                                                                // 161
  'with': 'Spacebars.With',                                                                             // 162
  'each': 'UI.Each'                                                                                     // 163
};                                                                                                      // 164
                                                                                                        // 165
// These must be prefixed with `UI.` when you use them in a template.                                   // 166
var builtInLexicals = {                                                                                 // 167
  'contentBlock': 'template.__content',                                                                 // 168
  'elseBlock': 'template.__elseContent'                                                                 // 169
};                                                                                                      // 170
                                                                                                        // 171
// A "reserved name" can't be used as a <template> name.  This                                          // 172
// function is used by the template file scanner.                                                       // 173
Spacebars.isReservedName = function (name) {                                                            // 174
  return builtInBlockHelpers.hasOwnProperty(name);                                                      // 175
};                                                                                                      // 176
                                                                                                        // 177
var codeGenTemplateTag = function (tag) {                                                               // 178
  if (tag.position === HTMLTools.TEMPLATE_TAG_POSITION.IN_START_TAG) {                                  // 179
    // only `tag.type === 'DOUBLE'` allowed (by earlier validation)                                     // 180
    return HTML.EmitCode('function () { return ' +                                                      // 181
                         codeGenMustache(tag.path, tag.args, 'attrMustache')                            // 182
                         + '; }');                                                                      // 183
  } else {                                                                                              // 184
    if (tag.type === 'DOUBLE') {                                                                        // 185
      return HTML.EmitCode('function () { return ' +                                                    // 186
                           codeGenMustache(tag.path, tag.args) + '; }');                                // 187
    } else if (tag.type === 'TRIPLE') {                                                                 // 188
      return HTML.EmitCode('function () { return Spacebars.makeRaw(' +                                  // 189
                           codeGenMustache(tag.path, tag.args) + '); }');                               // 190
    } else if (tag.type === 'INCLUSION' || tag.type === 'BLOCKOPEN') {                                  // 191
      var path = tag.path;                                                                              // 192
                                                                                                        // 193
      if (tag.type === 'BLOCKOPEN' &&                                                                   // 194
          builtInBlockHelpers.hasOwnProperty(path[0])) {                                                // 195
        // if, unless, with, each.                                                                      // 196
        //                                                                                              // 197
        // If someone tries to do `{{> if}}`, we don't                                                  // 198
        // get here, but an error is thrown when we try to codegen the path.                            // 199
                                                                                                        // 200
        // Note: If we caught these errors earlier, while scanning, we'd be able to                     // 201
        // provide nice line numbers.                                                                   // 202
        if (path.length > 1)                                                                            // 203
          throw new Error("Unexpected dotted path beginning with " + path[0]);                          // 204
        if (! tag.args.length)                                                                          // 205
          throw new Error("#" + path[0] + " requires an argument");                                     // 206
                                                                                                        // 207
        var codeParts = codeGenInclusionParts(tag);                                                     // 208
        var dataFunc = codeParts.dataFunc; // must exist (tag.args.length > 0)                          // 209
        var contentBlock = codeParts.content; // must exist                                             // 210
        var elseContentBlock = codeParts.elseContent; // may not exist                                  // 211
                                                                                                        // 212
        var callArgs = [dataFunc, contentBlock];                                                        // 213
        if (elseContentBlock)                                                                           // 214
          callArgs.push(elseContentBlock);                                                              // 215
                                                                                                        // 216
        return HTML.EmitCode(                                                                           // 217
          builtInBlockHelpers[path[0]] + '(' + callArgs.join(', ') + ')');                              // 218
                                                                                                        // 219
      } else {                                                                                          // 220
        var compCode = codeGenPath(path, {lookupTemplate: true});                                       // 221
                                                                                                        // 222
        if (path.length !== 1) {                                                                        // 223
          // path code may be reactive; wrap it                                                         // 224
          compCode = 'function () { return ' + compCode + '; }';                                        // 225
        }                                                                                               // 226
                                                                                                        // 227
        var codeParts = codeGenInclusionParts(tag);                                                     // 228
        var dataFunc = codeParts.dataFunc;                                                              // 229
        var content = codeParts.content;                                                                // 230
        var elseContent = codeParts.elseContent;                                                        // 231
                                                                                                        // 232
        var includeArgs = [compCode];                                                                   // 233
        if (content) {                                                                                  // 234
          includeArgs.push(content);                                                                    // 235
          if (elseContent)                                                                              // 236
            includeArgs.push(elseContent);                                                              // 237
        }                                                                                               // 238
                                                                                                        // 239
        var includeCode =                                                                               // 240
              'Spacebars.include(' + includeArgs.join(', ') + ')';                                      // 241
                                                                                                        // 242
        if (dataFunc) {                                                                                 // 243
          includeCode =                                                                                 // 244
            'Spacebars.TemplateWith(' + dataFunc + ', UI.block(' +                                      // 245
            Spacebars.codeGen(HTML.EmitCode(includeCode)) + '))';                                       // 246
        }                                                                                               // 247
                                                                                                        // 248
        if (path[0] === 'UI' &&                                                                         // 249
            (path[1] === 'contentBlock' || path[1] === 'elseBlock')) {                                  // 250
          includeCode = 'UI.InTemplateScope(template, ' + includeCode + ')';                            // 251
        }                                                                                               // 252
                                                                                                        // 253
        return HTML.EmitCode(includeCode);                                                              // 254
      }                                                                                                 // 255
    } else {                                                                                            // 256
      // Can't get here; TemplateTag validation should catch any                                        // 257
      // inappropriate tag types that might come out of the parser.                                     // 258
      throw new Error("Unexpected template tag type: " + tag.type);                                     // 259
    }                                                                                                   // 260
  }                                                                                                     // 261
};                                                                                                      // 262
                                                                                                        // 263
var makeObjectLiteral = function (obj) {                                                                // 264
  var parts = [];                                                                                       // 265
  for (var k in obj)                                                                                    // 266
    parts.push(toObjectLiteralKey(k) + ': ' + obj[k]);                                                  // 267
  return '{' + parts.join(', ') + '}';                                                                  // 268
};                                                                                                      // 269
                                                                                                        // 270
// `path` is an array of at least one string.                                                           // 271
//                                                                                                      // 272
// If `path.length > 1`, the generated code may be reactive                                             // 273
// (i.e. it may invalidate the current computation).                                                    // 274
//                                                                                                      // 275
// No code is generated to call the result if it's a function.                                          // 276
//                                                                                                      // 277
// Options:                                                                                             // 278
//                                                                                                      // 279
// - lookupTemplate {Boolean} If true, generated code also looks in                                     // 280
//   the list of templates. (After helpers, before data context).                                       // 281
//   Used when generating code for `{{> foo}}` or `{{#foo}}`. Only                                      // 282
//   used for non-dotted paths.                                                                         // 283
var codeGenPath = function (path, opts) {                                                               // 284
  if (builtInBlockHelpers.hasOwnProperty(path[0]))                                                      // 285
    throw new Error("Can't use the built-in '" + path[0] + "' here");                                   // 286
  // Let `{{#if UI.contentBlock}}` check whether this template was invoked via                          // 287
  // inclusion or as a block helper, in addition to supporting                                          // 288
  // `{{> UI.contentBlock}}`.                                                                           // 289
  if (path.length >= 2 &&                                                                               // 290
      path[0] === 'UI' && builtInLexicals.hasOwnProperty(path[1])) {                                    // 291
    if (path.length > 2)                                                                                // 292
      throw new Error("Unexpected dotted path beginning with " +                                        // 293
                      path[0] + '.' + path[1]);                                                         // 294
    return builtInLexicals[path[1]];                                                                    // 295
  }                                                                                                     // 296
                                                                                                        // 297
  var args = [toJSLiteral(path[0])];                                                                    // 298
  var lookupMethod = 'lookup';                                                                          // 299
  if (opts && opts.lookupTemplate && path.length === 1)                                                 // 300
    lookupMethod = 'lookupTemplate';                                                                    // 301
  var code = 'self.' + lookupMethod + '(' + args.join(', ') + ')';                                      // 302
                                                                                                        // 303
  if (path.length > 1) {                                                                                // 304
    code = 'Spacebars.dot(' + code + ', ' +                                                             // 305
      _.map(path.slice(1), toJSLiteral).join(', ') + ')';                                               // 306
  }                                                                                                     // 307
                                                                                                        // 308
  return code;                                                                                          // 309
};                                                                                                      // 310
                                                                                                        // 311
// Generates code for an `[argType, argValue]` argument spec,                                           // 312
// ignoring the third element (keyword argument name) if present.                                       // 313
//                                                                                                      // 314
// The resulting code may be reactive (in the case of a PATH of                                         // 315
// more than one element) and is not wrapped in a closure.                                              // 316
var codeGenArgValue = function (arg) {                                                                  // 317
  var argType = arg[0];                                                                                 // 318
  var argValue = arg[1];                                                                                // 319
                                                                                                        // 320
  var argCode;                                                                                          // 321
  switch (argType) {                                                                                    // 322
  case 'STRING':                                                                                        // 323
  case 'NUMBER':                                                                                        // 324
  case 'BOOLEAN':                                                                                       // 325
  case 'NULL':                                                                                          // 326
    argCode = toJSLiteral(argValue);                                                                    // 327
    break;                                                                                              // 328
  case 'PATH':                                                                                          // 329
    argCode = codeGenPath(argValue);                                                                    // 330
    break;                                                                                              // 331
  default:                                                                                              // 332
    // can't get here                                                                                   // 333
    throw new Error("Unexpected arg type: " + argType);                                                 // 334
  }                                                                                                     // 335
                                                                                                        // 336
  return argCode;                                                                                       // 337
};                                                                                                      // 338
                                                                                                        // 339
// Generates a call to `Spacebars.fooMustache` on evaluated arguments.                                  // 340
// The resulting code has no function literals and must be wrapped in                                   // 341
// one for fine-grained reactivity.                                                                     // 342
var codeGenMustache = function (path, args, mustacheType) {                                             // 343
  var nameCode = codeGenPath(path);                                                                     // 344
  var argCode = codeGenMustacheArgs(args);                                                              // 345
  var mustache = (mustacheType || 'mustache');                                                          // 346
                                                                                                        // 347
  return 'Spacebars.' + mustache + '(' + nameCode +                                                     // 348
    (argCode ? ', ' + argCode.join(', ') : '') + ')';                                                   // 349
};                                                                                                      // 350
                                                                                                        // 351
// returns: array of source strings, or null if no                                                      // 352
// args at all.                                                                                         // 353
var codeGenMustacheArgs = function (tagArgs) {                                                          // 354
  var kwArgs = null; // source -> source                                                                // 355
  var args = null; // [source]                                                                          // 356
                                                                                                        // 357
  // tagArgs may be null                                                                                // 358
  _.each(tagArgs, function (arg) {                                                                      // 359
    var argCode = codeGenArgValue(arg);                                                                 // 360
                                                                                                        // 361
    if (arg.length > 2) {                                                                               // 362
      // keyword argument (represented as [type, value, name])                                          // 363
      kwArgs = (kwArgs || {});                                                                          // 364
      kwArgs[arg[2]] = argCode;                                                                         // 365
    } else {                                                                                            // 366
      // positional argument                                                                            // 367
      args = (args || []);                                                                              // 368
      args.push(argCode);                                                                               // 369
    }                                                                                                   // 370
  });                                                                                                   // 371
                                                                                                        // 372
  // put kwArgs in options dictionary at end of args                                                    // 373
  if (kwArgs) {                                                                                         // 374
    args = (args || []);                                                                                // 375
    args.push('Spacebars.kw(' + makeObjectLiteral(kwArgs) + ')');                                       // 376
  }                                                                                                     // 377
                                                                                                        // 378
  return args;                                                                                          // 379
};                                                                                                      // 380
                                                                                                        // 381
// Takes an inclusion tag and returns an object containing these properties,                            // 382
// all optional, whose values are JS source code:                                                       // 383
//                                                                                                      // 384
// - `dataFunc` - source code of a data function literal                                                // 385
// - `content` - source code of a content block                                                         // 386
// - `elseContent` - source code of an elseContent block                                                // 387
//                                                                                                      // 388
// Implements the calling convention for inclusions.                                                    // 389
var codeGenInclusionParts = function (tag) {                                                            // 390
  var ret = {};                                                                                         // 391
                                                                                                        // 392
  if ('content' in tag) {                                                                               // 393
    ret.content = (                                                                                     // 394
      'UI.block(' + Spacebars.codeGen(tag.content) + ')');                                              // 395
  }                                                                                                     // 396
  if ('elseContent' in tag) {                                                                           // 397
    ret.elseContent = (                                                                                 // 398
      'UI.block(' + Spacebars.codeGen(tag.elseContent) + ')');                                          // 399
  }                                                                                                     // 400
                                                                                                        // 401
  var dataFuncCode = null;                                                                              // 402
                                                                                                        // 403
  var args = tag.args;                                                                                  // 404
  if (! args.length) {                                                                                  // 405
    // e.g. `{{#foo}}`                                                                                  // 406
    return ret;                                                                                         // 407
  } else if (args[0].length === 3) {                                                                    // 408
    // keyword arguments only, e.g. `{{> point x=1 y=2}}`                                               // 409
    var dataProps = {};                                                                                 // 410
    _.each(args, function (arg) {                                                                       // 411
      var argKey = arg[2];                                                                              // 412
      dataProps[argKey] = 'Spacebars.call(' + codeGenArgValue(arg) + ')';                               // 413
    });                                                                                                 // 414
    dataFuncCode = makeObjectLiteral(dataProps);                                                        // 415
  } else if (args[0][0] !== 'PATH') {                                                                   // 416
    // literal first argument, e.g. `{{> foo "blah"}}`                                                  // 417
    //                                                                                                  // 418
    // tag validation has confirmed, in this case, that there is only                                   // 419
    // one argument (`args.length === 1`)                                                               // 420
    dataFuncCode = codeGenArgValue(args[0]);                                                            // 421
  } else if (args.length === 1) {                                                                       // 422
    // one argument, must be a PATH                                                                     // 423
    dataFuncCode = 'Spacebars.call(' + codeGenPath(args[0][1]) + ')';                                   // 424
  } else {                                                                                              // 425
    dataFuncCode = codeGenMustache(args[0][1], args.slice(1),                                           // 426
                                   'dataMustache');                                                     // 427
  }                                                                                                     // 428
                                                                                                        // 429
  ret.dataFunc = 'function () { return ' + dataFuncCode + '; }';                                        // 430
                                                                                                        // 431
  return ret;                                                                                           // 432
};                                                                                                      // 433
                                                                                                        // 434
                                                                                                        // 435
// ============================================================                                         // 436
// Main compiler                                                                                        // 437
                                                                                                        // 438
var replaceSpecials = function (node) {                                                                 // 439
  if (node instanceof HTML.Tag) {                                                                       // 440
    // potential optimization: don't always create a new tag                                            // 441
    var newChildren = _.map(node.children, replaceSpecials);                                            // 442
    var newTag = HTML.getTag(node.tagName).apply(null, newChildren);                                    // 443
    var oldAttrs = node.attrs;                                                                          // 444
    var newAttrs = null;                                                                                // 445
                                                                                                        // 446
    if (oldAttrs) {                                                                                     // 447
      _.each(oldAttrs, function (value, name) {                                                         // 448
        if (name.charAt(0) !== '$') {                                                                   // 449
          newAttrs = (newAttrs || {});                                                                  // 450
          newAttrs[name] = replaceSpecials(value);                                                      // 451
        }                                                                                               // 452
      });                                                                                               // 453
                                                                                                        // 454
      if (oldAttrs.$specials && oldAttrs.$specials.length) {                                            // 455
        newAttrs = (newAttrs || {});                                                                    // 456
        newAttrs.$dynamic = _.map(oldAttrs.$specials, function (special) {                              // 457
          return codeGenTemplateTag(special.value);                                                     // 458
        });                                                                                             // 459
      }                                                                                                 // 460
    }                                                                                                   // 461
                                                                                                        // 462
    newTag.attrs = newAttrs;                                                                            // 463
    return newTag;                                                                                      // 464
  } else if (node instanceof Array) {                                                                   // 465
    return _.map(node, replaceSpecials);                                                                // 466
  } else if (node instanceof HTMLTools.Special) {                                                       // 467
    return codeGenTemplateTag(node.value);                                                              // 468
  } else {                                                                                              // 469
    return node;                                                                                        // 470
  }                                                                                                     // 471
};                                                                                                      // 472
                                                                                                        // 473
Spacebars.compile = function (input, options) {                                                         // 474
  var tree = Spacebars.parse(input);                                                                    // 475
  return Spacebars.codeGen(tree, options);                                                              // 476
};                                                                                                      // 477
                                                                                                        // 478
Spacebars.codeGen = function (parseTree, options) {                                                     // 479
  // is this a template, rather than a block passed to                                                  // 480
  // a block helper, say                                                                                // 481
  var isTemplate = (options && options.isTemplate);                                                     // 482
                                                                                                        // 483
  var tree = parseTree;                                                                                 // 484
                                                                                                        // 485
  // The flags `isTemplate` and `isBody` are kind of a hack.                                            // 486
  if (isTemplate || (options && options.isBody)) {                                                      // 487
    // optimizing fragments would require being smarter about whether we are                            // 488
    // in a TEXTAREA, say.                                                                              // 489
    tree = optimize(tree);                                                                              // 490
  }                                                                                                     // 491
                                                                                                        // 492
  tree = replaceSpecials(tree);                                                                         // 493
                                                                                                        // 494
  var code = '(function () { var self = this; ';                                                        // 495
  if (isTemplate) {                                                                                     // 496
    // support `{{> UI.contentBlock}}` and `{{> UI.elseBlock}}` with                                    // 497
    // lexical scope by creating a local variable in the                                                // 498
    // template's render function.                                                                      // 499
    code += 'var template = this; ';                                                                    // 500
  }                                                                                                     // 501
  code += 'return ';                                                                                    // 502
  code += HTML.toJS(tree);                                                                              // 503
  code += '; })';                                                                                       // 504
                                                                                                        // 505
  code = beautify(code);                                                                                // 506
                                                                                                        // 507
  return code;                                                                                          // 508
};                                                                                                      // 509
                                                                                                        // 510
var beautify = function (code) {                                                                        // 511
  if (Package.minifiers && Package.minifiers.UglifyJSMinify) {                                          // 512
    var result = UglifyJSMinify(code,                                                                   // 513
                                { fromString: true,                                                     // 514
                                  mangle: false,                                                        // 515
                                  compress: false,                                                      // 516
                                  output: { beautify: true,                                             // 517
                                            indent_level: 2,                                            // 518
                                            width: 80 } });                                             // 519
    var output = result.code;                                                                           // 520
    // Uglify interprets our expression as a statement and may add a semicolon.                         // 521
    // Strip trailing semicolon.                                                                        // 522
    output = output.replace(/;$/, '');                                                                  // 523
    return output;                                                                                      // 524
  } else {                                                                                              // 525
    // don't actually beautify; no UglifyJS                                                             // 526
    return code;                                                                                        // 527
  }                                                                                                     // 528
};                                                                                                      // 529
                                                                                                        // 530
// expose for compiler output tests                                                                     // 531
Spacebars._beautify = beautify;                                                                         // 532
                                                                                                        // 533
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['spacebars-compiler'] = {};

})();
