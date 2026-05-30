type Suggestion = {
  keywords: string[];
  exclude: string[];
};

type Rule = {
  detect: RegExp[];
  keywords: (name: string) => string[];
  exclude: string[];
};

const GENERIC_EXCLUDE = [
  "etui", "case", "pokrowiec", "szkło", "szklo", "folia", "kabel",
  "ładowarka", "ladowarka", "adapter", "uchwyt", "stojak", "podstawka",
  "uszkodzony", "uszkodzona", "uszkodzone", "nie działa", "nie dziala",
  "na części", "do naprawy", "części", "czesci", "część", "czesc",
  "instrukcja", "pudełko", "pudelko", "samo pudełko", "opakowanie",
  "naszywka", "koszulka", "plakat", "naklejka",
];

const RULES: Rule[] = [
  // ============ TELEFONY ============
  {
    detect: [/iphone/i, /apple phone/i],
    keywords: (name) => {
      const m = name.match(/iphone\s*(\d+)\s*(pro|plus|max|mini)?/i);
      if (!m) return ["iphone"];
      const num = m[1];
      const variant = m[2]?.toLowerCase() || "";
      const base = [`iphone ${num}`, `iphone${num}`];
      if (variant) base.push(`iphone ${num} ${variant}`, `iphone${num}${variant}`);
      return base;
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "iphone 15", "iphone 14", "iphone 13", "iphone 12", "iphone 11",
      "iphone x", "iphone xr", "iphone xs", "iphone se", "iphone 8", "iphone 7",
      "iphone 16", "iphone 17",
      "mac", "ipad", "airpods", "watch", "magsafe", "lightning", "usb-c",
      "wymiana", "szyba", "wyświetlacz", "ekran", "bateria",
    ],
  },
  {
    detect: [/samsung.*galaxy|galaxy.*s\d|samsung.*s\d|samsung.*a\d|samsung.*note/i],
    keywords: (name) => {
      const series = name.match(/galaxy\s*([a-z]\d+\+?)/i) || name.match(/samsung\s*([a-z]\d+\+?)/i);
      const model = series ? series[1].toLowerCase() : "";
      const base = ["samsung galaxy", `samsung ${model}`, `galaxy ${model}`].filter(Boolean);
      return [...new Set(base)];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "s6", "s7", "s8", "s9", "s10", "s10e", "s10+",
      "s21", "s22", "s23", "s24", "s25",
      "a12", "a13", "a14", "a15", "a32", "a33", "a34", "a52", "a53", "a54",
      "note 8", "note 9", "note 10", "note 20",
      "watch", "smartwatch", "zegarek", "buds", "słuchawki",
      "wyświetlacz", "ekran", "bateria", "wymiana", "szyba",
      "fold", "flip", "z fold", "z flip",
    ],
  },
  {
    detect: [/xiaomi|redmi|poco/i],
    keywords: (name) => {
      const m = name.match(/(xiaomi|redmi|poco)\s*([\w\s]+)/i);
      return m ? [m[0].toLowerCase().trim(), m[1].toLowerCase()] : ["xiaomi"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "watch", "smartwatch", "zegarek", "buds", "słuchawki", "band",
      "wyświetlacz", "ekran", "bateria", "wymiana",
      "pad", "tablet",
    ],
  },
  {
    detect: [/pixel\s*\d|google pixel/i],
    keywords: (name) => {
      const m = name.match(/pixel\s*(\d+)\s*(pro|xl|a)?/i);
      if (!m) return ["google pixel"];
      return [`pixel ${m[1]}`, `google pixel ${m[1]}`, m[2] ? `pixel ${m[1]} ${m[2]}` : ""].filter(Boolean);
    },
    exclude: [...GENERIC_EXCLUDE, "watch", "buds", "wyświetlacz", "ekran", "bateria"],
  },
  {
    detect: [/huawei|honor/i],
    keywords: (name) => [name.toLowerCase().trim()],
    exclude: [...GENERIC_EXCLUDE, "watch", "band", "buds", "tablet", "pad"],
  },
  // ============ KONSOLE ============
  {
    detect: [/ps5|playstation\s*5/i],
    keywords: () => ["ps5", "playstation 5", "konsola ps5", "konsola playstation 5"],
    exclude: [
      ...GENERIC_EXCLUDE,
      "pad", "kontroler", "joystick", "dysk", "podstawka", "chłodzenie",
      "gra", "game", "cd", "blu-ray",
      "far cry", "fifa", "ea sports", "call of duty", "cod",
      "god of war", "spider-man", "spiderman", "horizon",
      "elden ring", "cyberpunk", "hogwarts", "baldur",
      "assassin", "resident evil", "final fantasy",
      "mortal kombat", "street fighter", "nfs", "need for speed",
      "tony hawk", "minecraft", "fortnite", "gta",
      "vr2", "vr headset", "portal", "na ps5", "do ps5",
    ],
  },
  {
    detect: [/ps4|playstation\s*4/i],
    keywords: () => ["ps4", "playstation 4", "konsola ps4"],
    exclude: [
      ...GENERIC_EXCLUDE,
      "pad", "kontroler", "gra", "game", "na ps4", "do ps4",
      "vr", "ps4 pro", "ps4 slim",
    ],
  },
  {
    detect: [/xbox\s*(series|one|360|x|s)/i],
    keywords: (name) => {
      const m = name.match(/xbox\s*(series\s*[xs]|one|360)/i);
      return m ? [`xbox ${m[1].toLowerCase()}`, "xbox"] : ["xbox"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "pad", "kontroler", "gra", "game", "gamepass", "na xbox", "do xbox",
      "kinect",
    ],
  },
  {
    detect: [/nintendo\s*(switch|lite|oled)|switch\s*(lite|oled)?/i],
    keywords: (name) => {
      if (/oled/i.test(name)) return ["nintendo switch oled", "switch oled"];
      if (/lite/i.test(name)) return ["nintendo switch lite", "switch lite"];
      return ["nintendo switch", "switch"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "gra", "game", "joy-con", "joycon", "pro controller",
      "na switch", "do switch", "amiibo", "etui na switch",
      "pokemon", "zelda", "mario", "kirby", "metroid",
    ],
  },
  // ============ LAPTOPY ============
  {
    detect: [/macbook\s*(air|pro|m\d)/i],
    keywords: (name) => {
      const m = name.match(/macbook\s*(air|pro)/i);
      const chip = name.match(/m[1-4]/i);
      const base = m ? [`macbook ${m[1].toLowerCase()}`, "macbook"] : ["macbook"];
      if (chip) base.push(`macbook ${m?.[1]?.toLowerCase() || ""} ${chip[0].toLowerCase()}`.trim());
      return [...new Set(base)];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "ipad", "iphone", "magic keyboard", "magic mouse", "thunderbolt",
      "zasilacz", "magsafe", "adapter", "stacja dokująca",
    ],
  },
  {
    detect: [/thinkpad/i],
    keywords: (name) => {
      const m = name.match(/thinkpad\s*([\w]+)/i);
      return m ? [`thinkpad ${m[1].toLowerCase()}`, "thinkpad"] : ["thinkpad"];
    },
    exclude: [...GENERIC_EXCLUDE, "dock", "stacja dokująca", "zasilacz", "klawiatura"],
  },
  {
    detect: [/dell\s*(xps|latitude|inspiron|precision)/i],
    keywords: (name) => [name.toLowerCase().trim(), "dell"],
    exclude: [...GENERIC_EXCLUDE, "zasilacz", "dock", "mysz", "klawiatura"],
  },
  {
    detect: [/lenovo|hp\s*(elitebook|probook|spectre|envy|pavilion)|asus\s*(zenbook|vivobook|rog)/i],
    keywords: (name) => [name.toLowerCase().trim()],
    exclude: [...GENERIC_EXCLUDE, "zasilacz", "dock", "mysz", "klawiatura", "stacja"],
  },
  // ============ SŁUCHAWKI ============
  {
    detect: [/airpods/i],
    keywords: (name) => {
      if (/pro\s*2/i.test(name)) return ["airpods pro 2", "airpods pro2"];
      if (/pro/i.test(name)) return ["airpods pro"];
      if (/max/i.test(name)) return ["airpods max"];
      if (/4/i.test(name)) return ["airpods 4"];
      if (/3/i.test(name)) return ["airpods 3"];
      if (/2/i.test(name)) return ["airpods 2"];
      return ["airpods"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "airpods 1", "airpods 2", "airpods 3", "airpods 4",
      "airpods pro", "airpods pro 2", "airpods max",
      "wymiana", "nauszniki", "silikonowe końcówki",
    ],
  },
  {
    detect: [/sony\s*(wh|wf|linkbuds)|wh-1000|wf-1000/i],
    keywords: (name) => {
      const m = name.match(/(wh|wf)-[\w]+/i);
      return m ? [m[0].toLowerCase(), "sony " + m[0].toLowerCase(), "sony słuchawki"] : ["sony słuchawki"];
    },
    exclude: [...GENERIC_EXCLUDE, "poduszki", "nauszniki", "kabel", "pokrowiec"],
  },
  {
    detect: [/bose\s*(quietcomfort|700|nc\d+|soundsport)/i],
    keywords: (name) => [name.toLowerCase().trim(), "bose"],
    exclude: [...GENERIC_EXCLUDE, "poduszki", "nauszniki", "kabel"],
  },
  // ============ ZEGARKI ============
  {
    detect: [/apple\s*watch/i],
    keywords: (name) => {
      const m = name.match(/apple\s*watch\s*(series\s*\d+|se|ultra)?/i);
      return m ? [m[0].toLowerCase(), "apple watch"] : ["apple watch"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "pasek", "strap", "band", "szkło", "ładowarka", "magnetic",
      "series 1", "series 2", "series 3", "series 4",
    ],
  },
  {
    detect: [/casio|g-shock|edifice|baby-g/i],
    keywords: (name) => {
      const m = name.match(/casio\s*([\w-]+)/i);
      return m ? [`casio ${m[1].toLowerCase()}`, "casio zegarek", "zegarek casio"] : ["casio"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "pasek", "bateria", "szkło", "koperta", "uszkodzony",
      "smartwatch", "zegarek elektroniczny",
    ],
  },
  {
    detect: [/rolex|omega|seiko|tissot|hamilton|longines|tudor/i],
    keywords: (name) => [name.toLowerCase().trim()],
    exclude: [...GENERIC_EXCLUDE, "pasek", "bransoleta", "szkło", "koperta", "replika", "kopia"],
  },
  // ============ AGD ============
  {
    detect: [/dyson/i],
    keywords: (name) => {
      const m = name.match(/dyson\s*(v\d+|airwrap|supersonic|purifier|humidify|hot\+cool|pure)/i);
      return m ? [m[0].toLowerCase(), "dyson"] : ["dyson"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "filtr", "dysza", "końcówka", "akcesoria", "części",
      "ssawka", "szczotka", "bateria do dysona",
    ],
  },
  {
    detect: [/roomba|irobot/i],
    keywords: (name) => {
      const m = name.match(/roomba\s*([\w]+)/i);
      return m ? [`roomba ${m[1].toLowerCase()}`, "roomba", "irobot roomba"] : ["roomba"];
    },
    exclude: [...GENERIC_EXCLUDE, "filtr", "szczotka", "części", "stacja dokująca roomba"],
  },
  {
    detect: [/thermomix|vorwerk/i],
    keywords: () => ["thermomix", "vorwerk thermomix", "tm5", "tm6"],
    exclude: [...GENERIC_EXCLUDE, "akcesoria", "pojemnik", "nóż", "mieszadło", "książka"],
  },
  // ============ BUTY ============
  {
    detect: [/nike\s*(air\s*max|air\s*force|dunk|jordan|blazer|cortez|react)/i],
    keywords: (name) => {
      const m = name.match(/nike\s*(air\s*max\s*[\w]*|air\s*force\s*[\w]*|dunk\s*[\w]*|jordan\s*[\w]*)/i);
      return m ? [m[0].toLowerCase(), "nike " + m[1].toLowerCase().trim()] : ["nike"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "wkładka", "sznurówki", "sznurowadła", "torba", "plecak",
      "koszulka", "bluza", "spodnie", "skarpety",
      "rozmiar 36", "rozmiar 37", "rozmiar 38",
    ],
  },
  {
    detect: [/adidas\s*(samba|gazelle|ultraboost|stan\s*smith|yeezy|superstar|nmd)/i],
    keywords: (name) => {
      const m = name.match(/adidas\s*(samba|gazelle|ultraboost|stan\s*smith|yeezy|superstar|nmd)/i);
      return m ? [m[0].toLowerCase(), m[1].toLowerCase()] : ["adidas"];
    },
    exclude: [...GENERIC_EXCLUDE, "wkładka", "sznurówki", "koszulka", "bluza", "torba"],
  },
  {
    detect: [/gucci|louis\s*vuitton|lv\s*|prada|balenciaga|off-white|yeezy/i],
    keywords: (name) => [name.toLowerCase().trim()],
    exclude: [
      ...GENERIC_EXCLUDE,
      "koszulka", "bluza", "czapka", "pasek", "portfel", "torebka",
      "perfumy", "okulary", "replika", "kopia", "podróbka",
    ],
  },
  // ============ ROWERY / HULAJNOGI ============
  {
    detect: [/hulajnoga\s*(elektryczna|e-)?|xiaomi\s*scooter|segway/i],
    keywords: (name) => [name.toLowerCase().trim(), "hulajnoga elektryczna"],
    exclude: [...GENERIC_EXCLUDE, "części", "koło", "opona", "hamulec", "ładowarka"],
  },
  {
    detect: [/e-bike|rower\s*elektryczny|ebike/i],
    keywords: (name) => [name.toLowerCase().trim(), "rower elektryczny", "e-bike"],
    exclude: [...GENERIC_EXCLUDE, "części", "koło", "opona", "hamulec", "silnik", "bateria do roweru"],
  },
  // ============ APARATY / OBIEKTYWY ============
  {
    detect: [/sony\s*(a[67]\d{3}|zv|fx)|fujifilm|canon\s*(eos|r\d)|nikon\s*(z\d|d\d{3,4})/i],
    keywords: (name) => [name.toLowerCase().trim()],
    exclude: [
      ...GENERIC_EXCLUDE,
      "obiektyw", "torba", "plecak", "statyw", "lampa", "filtr do obiektywu",
      "bateria do aparatu", "grip", "uchwyt", "karta pamięci",
    ],
  },
  // ============ KARTY GRAFICZNE / PC ============
  {
    detect: [/rtx\s*(3\d{3}|4\d{3})|rx\s*(6\d{3}|7\d{3})|gtx\s*\d{3,4}/i],
    keywords: (name) => {
      const m = name.match(/(rtx|rx|gtx)\s*[\w]+/i);
      return m ? [m[0].toLowerCase(), "karta graficzna " + m[0].toLowerCase()] : ["karta graficzna"];
    },
    exclude: [
      ...GENERIC_EXCLUDE,
      "cooler", "chłodzenie", "bracket", "backplate", "connector",
      "benchmark", "mining", "koparka",
    ],
  },
];

export function getSuggestions(name: string): Suggestion | null {
  if (!name.trim()) return null;

  for (const rule of RULES) {
    if (rule.detect.some(r => r.test(name))) {
      const keywords = rule.keywords(name);
      const exclude = [...new Set(rule.exclude)];
      return { keywords, exclude };
    }
  }

  // Brak dopasowania — zwróć tylko generyczne wykluczenia
  return {
    keywords: [],
    exclude: GENERIC_EXCLUDE,
  };
}
