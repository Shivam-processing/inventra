export type NiceClass = {
  number: number;
  type: "GOODS" | "SERVICES";
  heading: string;
  plainTitle: string;
  examples: string[];
  keywords: string[];
};

export type NiceClassSuggestion = {
  niceClass: number;
  reason: string;
  confidence: "STRONG_POSSIBILITY" | "POSSIBLE" | "REVIEW_NEEDED";
};

export type ClassFinderCategory = "PHYSICAL_PRODUCT" | "SOFTWARE_ELECTRONICS" | "MEDICAL" | "FOOD_DRINK" | "CLOTHING_ACCESSORIES" | "BUSINESS_RETAIL" | "ONLINE_TECH" | "EDUCATION_ENTERTAINMENT" | "OTHER";

export const NICE_CLASSIFICATION = { version: "13-2026", lastReviewed: "2026-07-28", officialSource: "https://nclpub.wipo.int/" } as const;

const headings = [
  "Chemicals for industry, science and agriculture", "Paints, varnishes and preservatives", "Cosmetics, toiletries and cleaning preparations", "Industrial oils, greases, lubricants and fuels", "Pharmaceuticals, medical and veterinary preparations", "Common metals and metal goods", "Machines, machine tools and motors", "Hand tools and implements", "Scientific, electronic, optical and software goods", "Surgical, medical, dental and veterinary apparatus", "Lighting, heating, cooling, cooking and sanitary apparatus", "Vehicles and transport apparatus", "Firearms, ammunition and explosives", "Precious metals, jewellery and watches", "Musical instruments", "Paper, printed matter, stationery and office requisites", "Rubber, plastics, insulation and flexible non-metal materials", "Leather goods, luggage, bags and umbrellas", "Non-metal building materials", "Furniture, containers and non-metal household fittings", "Household and kitchen utensils and containers", "Ropes, tents, sacks and raw textile fibres", "Yarns and threads", "Textiles, fabrics and household linen", "Clothing, footwear and headwear", "Lace, buttons, artificial flowers and hair accessories", "Carpets, floor coverings and wall hangings", "Games, toys and sporting articles", "Meat, fish, dairy and preserved foods", "Coffee, tea, flour, bread, confectionery and seasonings", "Raw agricultural products, plants and animal feed", "Beers and non-alcoholic beverages", "Alcoholic beverages except beers", "Tobacco and smokers’ articles", "Advertising, business management and retail services", "Financial, insurance and real-estate services", "Construction, installation and repair services", "Telecommunications services", "Transport, packaging, storage and travel services", "Treatment and transformation of materials", "Education, training, entertainment and sporting activities", "Scientific, technological, software and design services", "Food, drink and temporary-accommodation services", "Medical, veterinary, hygiene, beauty and agricultural services", "Legal, security, personal and social services",
] as const;

const classDetails: Record<number, { plainTitle: string; examples: string[]; related: string[] }> = {
  5: { plainTitle: "Medicines and pharmaceutical preparations", examples: ["Medicines", "pharmaceutical preparations", "medical supplements"], related: ["pharma", "medicine", "drug"] },
  7: { plainTitle: "Machines, motors and industrial tools", examples: ["Machines", "machine tools", "industrial motors"], related: ["machine", "tool", "motor"] },
  9: { plainTitle: "Electronics and downloadable software", examples: ["Mobile application downloads", "electronic sensors", "installed device software"], related: ["mobile app", "downloadable app", "electronics", "sensor", "computer software"] },
  10: { plainTitle: "Medical and healthcare apparatus", examples: ["Medical devices", "pill dispensers", "diagnostic apparatus"], related: ["pill box", "medicine box", "medication dispenser", "pill organiser", "medical device", "healthcare equipment"] },
  11: { plainTitle: "Lighting, water, heating and sanitary equipment", examples: ["Water purifiers", "lighting apparatus", "heating and cooling equipment"], related: ["water purifier", "water purification", "air conditioner", "sanitary equipment"] },
  12: { plainTitle: "Vehicles and transport apparatus", examples: ["Vehicles", "bicycles", "transport apparatus"], related: ["vehicle", "car", "bicycle"] },
  14: { plainTitle: "Jewellery, watches and precious metals", examples: ["Jewellery", "watches", "precious-metal goods"], related: ["jewelry", "jewellery", "watch"] },
  16: { plainTitle: "Printed matter and stationery", examples: ["Printed publications", "stationery", "office requisites"], related: ["printed product", "stationery", "book"] },
  18: { plainTitle: "Bags, luggage and leather goods", examples: ["Bags", "luggage", "umbrellas"], related: ["bag", "luggage", "accessories"] },
  21: { plainTitle: "Household and kitchen products", examples: ["Household containers", "kitchen utensils", "non-electric household products"], related: ["household product", "kitchen product", "container"] },
  25: { plainTitle: "Clothing, footwear and headwear", examples: ["Clothing", "shoes", "hats"], related: ["clothes", "apparel", "fashion"] },
  28: { plainTitle: "Toys, games and sporting goods", examples: ["Toys", "games", "sports equipment"], related: ["toy", "sports product", "game"] },
  29: { plainTitle: "Prepared and preserved foods", examples: ["Dairy products", "preserved foods", "prepared foods"], related: ["prepared food", "dairy", "snack"] },
  30: { plainTitle: "Staple foods, bakery and confectionery", examples: ["Coffee and tea", "bread", "confectionery"], related: ["bakery", "coffee", "tea", "confectionery"] },
  32: { plainTitle: "Non-alcoholic drinks", examples: ["Soft drinks", "fruit beverages", "non-alcoholic drinks"], related: ["drink", "beverage", "juice"] },
  35: { plainTitle: "Business, advertising and retail services", examples: ["Online retail services", "business consulting", "advertising"], related: ["online shop", "online store", "retail", "business consulting", "marketing"] },
  38: { plainTitle: "Telecommunications services", examples: ["Telecommunications", "message transmission", "communications services"], related: ["telecom", "communications service"] },
  41: { plainTitle: "Education and entertainment services", examples: ["Education", "training", "entertainment services"], related: ["education", "course", "training", "entertainment"] },
  42: { plainTitle: "Hosted software and technical services", examples: ["Software provided online", "SaaS", "technical design and research"], related: ["online software", "hosted software", "saas", "technical consulting", "software service"] },
  43: { plainTitle: "Food, drink and accommodation services", examples: ["Restaurant services", "cafés", "temporary accommodation"], related: ["restaurant", "cafe", "hotel"] },
  44: { plainTitle: "Healthcare and medical services", examples: ["Healthcare services", "medical clinics", "hygiene and beauty services"], related: ["healthcare service", "medical service", "clinic"] },
};

export const NICE_CLASSES: NiceClass[] = headings.map((heading, index) => {
  const number = index + 1;
  const details = classDetails[number] ?? { plainTitle: heading, examples: [heading], related: [] };
  return {
    number,
    type: number <= 34 ? "GOODS" : "SERVICES",
    heading,
    plainTitle: details.plainTitle,
    examples: details.examples,
    keywords: [...heading.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2), ...details.related],
  };
});

function searchText(item: NiceClass) {
  return [item.number, item.heading, item.plainTitle, ...item.examples, ...item.keywords].join(" ").toLowerCase();
}

export function searchNiceClasses(query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return NICE_CLASSES;
  const terms = value.split(/\s+/).filter(Boolean);
  return NICE_CLASSES
    .map((item) => {
      const haystack = searchText(item);
      const exactPhrase = haystack.includes(value);
      const termMatches = terms.filter((term) => haystack.includes(term)).length;
      return { item, score: exactPhrase ? 100 + termMatches : termMatches };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.number - b.item.number)
    .map(({ item }) => item);
}

export function niceClass(number: number) {
  return NICE_CLASSES.find((item) => item.number === number) ?? null;
}

export const CLASS_FINDER_CATEGORIES: { value: ClassFinderCategory; label: string }[] = [
  { value: "PHYSICAL_PRODUCT", label: "A physical product" },
  { value: "SOFTWARE_ELECTRONICS", label: "Downloadable software or electronics" },
  { value: "MEDICAL", label: "Medical or healthcare equipment" },
  { value: "FOOD_DRINK", label: "Food or drink" },
  { value: "CLOTHING_ACCESSORIES", label: "Clothing or accessories" },
  { value: "BUSINESS_RETAIL", label: "Business or retail services" },
  { value: "ONLINE_TECH", label: "Online software or technical services" },
  { value: "EDUCATION_ENTERTAINMENT", label: "Education or entertainment services" },
  { value: "OTHER", label: "Something else" },
];

const finderDetails: Record<ClassFinderCategory, { value: string; label: string; classes: number[] }[]> = {
  PHYSICAL_PRODUCT: [
    { value: "household", label: "Household product", classes: [21] },
    { value: "machine", label: "Machine or tool", classes: [7] },
    { value: "vehicle", label: "Vehicle", classes: [12] },
    { value: "utility", label: "Water, heating or cooling equipment", classes: [11] },
    { value: "toy", label: "Toy or sports product", classes: [28] },
    { value: "printed", label: "Printed or stationery product", classes: [16] },
  ],
  SOFTWARE_ELECTRONICS: [
    { value: "downloadable", label: "Downloadable application", classes: [9] },
    { value: "installed", label: "Installed device software", classes: [9] },
    { value: "electronic", label: "Electronic product or equipment", classes: [9] },
    { value: "hosted", label: "Hosted SaaS or technical service", classes: [42] },
  ],
  MEDICAL: [
    { value: "apparatus", label: "Medical apparatus", classes: [10] },
    { value: "medicine", label: "Medicine or pharmaceutical preparation", classes: [5] },
    { value: "service", label: "Healthcare service", classes: [44] },
  ],
  FOOD_DRINK: [
    { value: "prepared", label: "Prepared or preserved food", classes: [29] },
    { value: "staple", label: "Bakery, coffee, tea or confectionery", classes: [30] },
    { value: "beverage", label: "Non-alcoholic beverage", classes: [32] },
    { value: "restaurant", label: "Restaurant or café service", classes: [43] },
  ],
  CLOTHING_ACCESSORIES: [
    { value: "clothing", label: "Clothing, footwear or headwear", classes: [25] },
    { value: "jewellery", label: "Jewellery or watches", classes: [14] },
    { value: "bags", label: "Bags or luggage", classes: [18] },
  ],
  BUSINESS_RETAIL: [
    { value: "retail", label: "Retail or online shop", classes: [35] },
    { value: "consulting", label: "Business consulting or advertising", classes: [35] },
  ],
  ONLINE_TECH: [
    { value: "saas", label: "Hosted SaaS", classes: [42] },
    { value: "technical", label: "Technical, design or software service", classes: [42] },
    { value: "telecom", label: "Telecommunications service", classes: [38] },
  ],
  EDUCATION_ENTERTAINMENT: [
    { value: "education", label: "Education or training", classes: [41] },
    { value: "entertainment", label: "Entertainment or sporting activity", classes: [41] },
  ],
  OTHER: [{ value: "review", label: "I need to review the full class list", classes: [] }],
};

export function classFinderDetails(category: ClassFinderCategory | "") {
  return category ? finderDetails[category] : [];
}

export function classFinderSuggestions(category: ClassFinderCategory | "", detail: string): NiceClassSuggestion[] {
  if (!category || !detail) return [];
  const match = finderDetails[category].find((item) => item.value === detail);
  return (match?.classes ?? []).map((niceClassNumber) => ({
    niceClass: niceClassNumber,
    reason: `This class may apply when customers receive ${match?.label.toLowerCase()} under the brand.`,
    confidence: category === "OTHER" ? "REVIEW_NEEDED" : "STRONG_POSSIBILITY",
  }));
}

function includes(text: string, pattern: RegExp) {
  return pattern.test(text.toLowerCase());
}

export function suggestNiceClassesFromContext(context: string, primaryClass?: number): NiceClassSuggestion[] {
  const text = context.trim().toLowerCase();
  if (!text) return [];
  const suggestions: NiceClassSuggestion[] = [];
  const add = (niceClassNumber: number, reason: string, confidence: NiceClassSuggestion["confidence"]) => {
    if (niceClassNumber !== primaryClass && !suggestions.some((item) => item.niceClass === niceClassNumber)) suggestions.push({ niceClass: niceClassNumber, reason, confidence });
  };
  if (includes(text, /\b(pill|medicine|medication)\b.*\b(box|organiser|organizer|dispenser|compartment|apparatus)|\bmedical (apparatus|device|equipment)\b/)) add(10, "Likely relevant if the brand is used on a physical medical or medicine-dispensing apparatus.", "STRONG_POSSIBILITY");
  if (includes(text, /\b(water purifier|water purification|sanitary apparatus|heating equipment|cooling equipment)\b/)) add(11, "May apply when the brand is used on water, sanitary, heating or cooling apparatus.", "STRONG_POSSIBILITY");
  if (includes(text, /\b(downloadable|mobile app|installed software|measuring equipment)\b|\belectronic\b.{0,40}\b(control|equipment|sensor|monitor|measur)/)) add(9, "May apply when electronic equipment or downloadable software is sold separately under the brand.", "POSSIBLE");
  if (includes(text, /\b(hosted|saas|software as a service|online (?:software|monitoring)|technical service|cloud service)\b/)) add(42, "Applies only when hosted software or technical services are separately offered under the brand.", "POSSIBLE");
  if (includes(text, /\b(online shop|online store|retail service|business consulting|advertising service)\b/)) add(35, "May apply when retail, advertising or business services are provided under the brand.", "POSSIBLE");
  if (includes(text, /\b(clothing|footwear|headwear|apparel)\b/)) add(25, "May apply when clothing, footwear or headwear is sold under the brand.", "STRONG_POSSIBILITY");
  if (includes(text, /\b(jewellery|jewelry|watches)\b/)) add(14, "May apply when jewellery or watches are sold under the brand.", "STRONG_POSSIBILITY");
  if (includes(text, /\b(education|training course|entertainment service)\b/)) add(41, "May apply when education, training or entertainment services are provided under the brand.", "STRONG_POSSIBILITY");
  return suggestions.slice(0, 5);
}

export type ClassMismatchWarning = {
  selectedClass: number;
  suggestedClass: number;
  message: string;
  explanation: string;
};

export function detectStrongClassMismatch(context: string, selectedClass: number): ClassMismatchWarning | null {
  const suggestion = suggestNiceClassesFromContext(context, selectedClass).find((item) => item.confidence === "STRONG_POSSIBILITY");
  if (!suggestion) return null;
  if (suggestion.niceClass === 10 && selectedClass === 11) return {
    selectedClass,
    suggestedClass: 10,
    message: "The selected class may not be the closest class for the supplied product.",
    explanation: "Class 10 may be more relevant if the mark is used on a physical medical or medicine-dispensing apparatus. Class 11 generally covers lighting, heating, cooling, cooking and sanitary apparatus.",
  };
  return {
    selectedClass,
    suggestedClass: suggestion.niceClass,
    message: "The selected class may not be the closest class for the supplied product.",
    explanation: `${suggestion.reason} This is preliminary classification guidance, not legal advice.`,
  };
}

export function resolveClassMismatchDecision(warning: ClassMismatchWarning, decision: "SWITCH" | "CONTINUE"): number {
  return decision === "SWITCH" ? warning.suggestedClass : warning.selectedClass;
}
