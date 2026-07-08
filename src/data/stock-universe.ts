// 銘柄提案の対象ユニバース（6セクター）
// - 株主優待・権利確定月は目安の静的データ（変更されることがあるため、最新は各社IRを確認）
// - 銘柄の追加・修正はこのファイルを編集する

export type Sector = "半導体" | "AI" | "小売" | "製造メーカー" | "商社" | "サービス業";

export const SECTORS: Sector[] = ["半導体", "AI", "小売", "製造メーカー", "商社", "サービス業"];

export type YutaiInfo = {
  content: string; // 優待内容の概要
  minShares: number; // 必要最低株数
  estAnnualValue?: number; // 年間価値の目安（円）
  attractiveness: 1 | 2 | 3 | 4 | 5; // 優待の魅力度（主観的な目安）
};

export type UniverseStock = {
  code: string; // 証券コード
  name: string;
  sector: Sector;
  note?: string; // 事業の一言メモ
  yutai?: YutaiInfo;
  exMonths: number[]; // 権利確定月（目安）
};

export const STOCK_UNIVERSE: UniverseStock[] = [
  // ─── 半導体 ───
  { code: "8035", name: "東京エレクトロン", sector: "半導体", note: "半導体製造装置 世界大手", exMonths: [3, 9] },
  { code: "6857", name: "アドバンテスト", sector: "半導体", note: "半導体テスタ 世界首位級・AI向け好調", exMonths: [3, 9] },
  { code: "6920", name: "レーザーテック", sector: "半導体", note: "EUVマスク検査装置で独占的地位", exMonths: [6, 12] },
  { code: "6146", name: "ディスコ", sector: "半導体", note: "ダイサー・グラインダで世界首位", exMonths: [3, 9] },
  { code: "7735", name: "SCREENホールディングス", sector: "半導体", note: "洗浄装置で世界首位", exMonths: [3, 9] },
  { code: "6723", name: "ルネサスエレクトロニクス", sector: "半導体", note: "車載マイコン大手", exMonths: [6, 12] },
  { code: "4063", name: "信越化学工業", sector: "半導体", note: "シリコンウエハ世界首位・高収益", exMonths: [3, 9] },
  { code: "6963", name: "ローム", sector: "半導体", note: "パワー半導体・カスタムLSI", exMonths: [3, 9] },
  { code: "6526", name: "ソシオネクスト", sector: "半導体", note: "先端ロジックのファブレス設計", exMonths: [3, 9] },
  { code: "3436", name: "SUMCO", sector: "半導体", note: "シリコンウエハ大手", exMonths: [6, 12] },

  // ─── AI ───
  { code: "9984", name: "ソフトバンクグループ", sector: "AI", note: "AI投資持株会社（Arm・OpenAI等）", exMonths: [3, 9] },
  { code: "6501", name: "日立製作所", sector: "AI", note: "Lumada（データ×AI）が成長ドライバー", exMonths: [3, 9] },
  { code: "6701", name: "NEC", sector: "AI", note: "生成AI・生体認証・ITサービス", exMonths: [3, 9] },
  { code: "6702", name: "富士通", sector: "AI", note: "国産クラウド・AIサービス", exMonths: [3, 9] },
  { code: "9613", name: "NTTデータグループ", sector: "AI", note: "SI最大手・データセンター", exMonths: [3, 9] },
  { code: "4307", name: "野村総合研究所", sector: "AI", note: "コンサル×ITの高収益SI", exMonths: [3, 9] },
  { code: "3778", name: "さくらインターネット", sector: "AI", note: "国産GPUクラウド", exMonths: [3, 9] },
  { code: "3993", name: "PKSHA Technology", sector: "AI", note: "AIアルゴリズムSaaS", exMonths: [9] },
  { code: "2158", name: "FRONTEO", sector: "AI", note: "自然言語処理AI（リーガル・医療）", exMonths: [3] },
  { code: "6098", name: "リクルートホールディングス", sector: "AI", note: "Indeed等 HRテック×AIマッチング", exMonths: [3, 9] },

  // ─── 小売 ───
  { code: "9983", name: "ファーストリテイリング", sector: "小売", note: "ユニクロ 世界展開", exMonths: [2, 8] },
  { code: "3382", name: "セブン&アイ・ホールディングス", sector: "小売", note: "コンビニ世界大手", exMonths: [2, 8] },
  {
    code: "8267", name: "イオン", sector: "小売", note: "総合小売最大手",
    yutai: { content: "オーナーズカード（買物金額の3%キャッシュバック等）", minShares: 100, estAnnualValue: 6000, attractiveness: 5 },
    exMonths: [2, 8],
  },
  {
    code: "9843", name: "ニトリホールディングス", sector: "小売", note: "家具・ホームファニシング首位",
    yutai: { content: "お買物優待券（10%割引券5枚）", minShares: 100, estAnnualValue: 5000, attractiveness: 3 },
    exMonths: [2],
  },
  {
    code: "7532", name: "パン・パシフィック・インターナショナルHD", sector: "小売", note: "ドン・キホーテ",
    yutai: { content: "majicaポイント贈呈（年2,000pt目安）", minShares: 100, estAnnualValue: 2000, attractiveness: 3 },
    exMonths: [6, 12],
  },
  {
    code: "3048", name: "ビックカメラ", sector: "小売", note: "家電量販大手",
    yutai: { content: "買物優待券（100株で年3,000円相当・長期加算あり）", minShares: 100, estAnnualValue: 3000, attractiveness: 4 },
    exMonths: [2, 8],
  },
  {
    code: "2702", name: "日本マクドナルドホールディングス", sector: "小売", note: "外食最大級・優待人気銘柄",
    yutai: { content: "優待食事引換券（バーガー・サイド・ドリンク各6枚×年2回）", minShares: 100, estAnnualValue: 9000, attractiveness: 5 },
    exMonths: [6, 12],
  },
  {
    code: "8233", name: "高島屋", sector: "小売", note: "百貨店大手",
    yutai: { content: "株主優待カード（買物10%割引）", minShares: 100, estAnnualValue: 5000, attractiveness: 3 },
    exMonths: [2, 8],
  },
  {
    code: "3099", name: "三越伊勢丹ホールディングス", sector: "小売", note: "百貨店首位",
    yutai: { content: "株主優待カード（買物10%割引・限度額あり）", minShares: 100, estAnnualValue: 5000, attractiveness: 3 },
    exMonths: [3, 9],
  },
  { code: "3092", name: "ZOZO", sector: "小売", note: "ファッションEC首位・高ROE", exMonths: [3, 9] },

  // ─── 製造メーカー ───
  { code: "7203", name: "トヨタ自動車", sector: "製造メーカー", note: "世界最大級の自動車メーカー", exMonths: [3, 9] },
  { code: "6758", name: "ソニーグループ", sector: "製造メーカー", note: "ゲーム・音楽・イメージセンサー", exMonths: [3, 9] },
  { code: "6861", name: "キーエンス", sector: "製造メーカー", note: "FAセンサー・営業利益率50%超", exMonths: [3, 9] },
  { code: "6367", name: "ダイキン工業", sector: "製造メーカー", note: "空調世界首位", exMonths: [3, 9] },
  { code: "6981", name: "村田製作所", sector: "製造メーカー", note: "積層セラミックコンデンサ世界首位", exMonths: [3, 9] },
  { code: "7267", name: "ホンダ", sector: "製造メーカー", note: "二輪世界首位・株主還元強化", exMonths: [3, 9] },
  { code: "6301", name: "小松製作所", sector: "製造メーカー", note: "建機世界2位・高配当", exMonths: [3, 9] },
  { code: "6594", name: "ニデック", sector: "製造メーカー", note: "精密モーター世界首位", exMonths: [3, 9] },
  { code: "7741", name: "HOYA", sector: "製造メーカー", note: "マスクブランクス・メガネ 高収益", exMonths: [3, 9] },
  { code: "6273", name: "SMC", sector: "製造メーカー", note: "空圧制御機器 世界首位", exMonths: [3, 9] },

  // ─── 商社 ───
  { code: "8058", name: "三菱商事", sector: "商社", note: "総合商社最大手・累進配当", exMonths: [3, 9] },
  { code: "8031", name: "三井物産", sector: "商社", note: "資源に強い総合商社", exMonths: [3, 9] },
  { code: "8001", name: "伊藤忠商事", sector: "商社", note: "非資源に強い・生活消費分野", exMonths: [3, 9] },
  { code: "8053", name: "住友商事", sector: "商社", note: "総合商社大手・累進配当", exMonths: [3, 9] },
  { code: "8002", name: "丸紅", sector: "商社", note: "穀物・電力に強み", exMonths: [3, 9] },
  { code: "8015", name: "豊田通商", sector: "商社", note: "トヨタ系商社・アフリカ事業", exMonths: [3, 9] },
  { code: "2768", name: "双日", sector: "商社", note: "中堅総合商社・高配当", exMonths: [3, 9] },
  { code: "8020", name: "兼松", sector: "商社", note: "電子・食料の専門商社", exMonths: [3, 9] },
  { code: "7459", name: "メディパルホールディングス", sector: "商社", note: "医薬品卸最大手", exMonths: [3, 9] },
  { code: "9962", name: "ミスミグループ本社", sector: "商社", note: "FA部品のEC商社", exMonths: [3, 9] },

  // ─── サービス業 ───
  {
    code: "4661", name: "オリエンタルランド", sector: "サービス業", note: "東京ディズニーリゾート運営",
    yutai: { content: "1デーパスポート（500株以上で年1枚〜）", minShares: 500, estAnnualValue: 10900, attractiveness: 4 },
    exMonths: [3, 9],
  },
  { code: "4689", name: "LINEヤフー", sector: "サービス業", note: "国内最大級ポータル・メッセンジャー", exMonths: [3, 9] },
  { code: "2413", name: "エムスリー", sector: "サービス業", note: "医療従事者プラットフォーム", exMonths: [3, 9] },
  { code: "4385", name: "メルカリ", sector: "サービス業", note: "フリマアプリ首位・フィンテック", exMonths: [6] },
  {
    code: "9433", name: "KDDI", sector: "サービス業", note: "通信大手・連続増配",
    yutai: { content: "Pontaポイント等の選択制優待（保有年数で増額）", minShares: 100, estAnnualValue: 2000, attractiveness: 3 },
    exMonths: [3, 9],
  },
  {
    code: "9201", name: "日本航空", sector: "サービス業", note: "航空大手",
    yutai: { content: "国内線50%割引券（100株で年1枚〜）", minShares: 100, estAnnualValue: 8000, attractiveness: 4 },
    exMonths: [3, 9],
  },
  {
    code: "9202", name: "ANAホールディングス", sector: "サービス業", note: "航空最大手",
    yutai: { content: "国内線50%割引券（100株で年2枚）", minShares: 100, estAnnualValue: 16000, attractiveness: 4 },
    exMonths: [3, 9],
  },
  {
    code: "3197", name: "すかいらーくホールディングス", sector: "サービス業", note: "ガスト等 外食大手",
    yutai: { content: "優待カード（100株で年4,000円分目安）", minShares: 100, estAnnualValue: 4000, attractiveness: 4 },
    exMonths: [6, 12],
  },
  {
    code: "7581", name: "サイゼリヤ", sector: "サービス業", note: "低価格イタリアン外食",
    yutai: { content: "優待食事券（2023年新設・年2,000円分目安）", minShares: 100, estAnnualValue: 2000, attractiveness: 3 },
    exMonths: [8],
  },
  { code: "9143", name: "SGホールディングス", sector: "サービス業", note: "佐川急便・物流大手", exMonths: [3, 9] },
];

export function findUniverseStock(code: string): UniverseStock | undefined {
  return STOCK_UNIVERSE.find((s) => s.code === code);
}

// 権利確定月の目安（ユニバース外の銘柄は 3月/9月 とみなす）
export function exMonthsFor(code: string | null | undefined): number[] {
  if (!code) return [3, 9];
  return findUniverseStock(code)?.exMonths ?? [3, 9];
}
