import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "presentation", "assets");
const outFile = path.join(root, "presentation", "Desktop-REST-Client-Overview.pptx");

/** Цветова схема — тъмен хедър + тюркоазен акцент (близо до UI на клиента) */
const C = {
  bgSlide: "F1F5F9",
  header: "0F172A",
  accent: "14B8A6",
  textDark: "1E293B",
  textMuted: "64748B",
  textOnDark: "F8FAFC",
  footerLine: "CBD5E1",
};

const FONT = "Calibri";
const DECK_TITLE = "Desktop REST Client";

const slidesData = [
  {
    title: "Списък с REST API устройства",
    image: "01-devices.png",
    bullets: [
      "Това е основният екран за управление на API цели: всяка карта е устройство с хост, порт и пълен адрес.",
      "Подсветеният запис определя към кой сървър клиентът изпраща следващите заявки.",
      "Бутоните за настройки и „Ново“ добавят или редактират записи; експорт и импорт пренасят профилите между среди.",
      "Областта с детайли по-долу позволява подробно редактиране на избраното устройство.",
    ],
  },
  {
    title: "Конфигурация на устройство",
    image: "02-details.png",
    bullets: [
      "Задава се как се достига API: име, IP адрес, порт, протокол и по избор базов път (напр. /config).",
      "Секцията „Автентикация“ избира как се подписват заявките (няма, токен и т.н.).",
      "По желание се включва health check към зададен път с интервал и таймаут за проверка на наличност.",
      "„Запази“ записва профила, „Изтрий“ го премахва; полето за статус отразява състоянието при активни проверки.",
    ],
  },
  {
    title: "Единична HTTP заявка",
    image: "03-requests.png",
    bullets: [
      "В раздел „Заявки“ се изгражда една заявка: метод, път, query параметри, JSON заглавки, тяло и таймаут.",
      "„Изпрати“ изпълнява повикването към базовия URL на активното устройство; панелът „Отговор“ показва резултата.",
      "Потокът е стандартен за REST клиент: композиране, изпълнение и преглед на статус и съдържание.",
      "Удобно за ръчно тестване и бърза валидация спрямо работещ бекенд.",
    ],
  },
  {
    title: "История на заявките",
    image: "04-history.png",
    bullets: [
      "Историята пази хронологичен дневник на изпълнените повиквания с метод, URL, HTTP статус и време.",
      "Филтрите по метод, път и статус помагат при проследяване на грешки — например множество 404 отговора.",
      "„Изчисти“ нулира списъка за нова работна сесия.",
      "При избор на запис се показват пълните детайли на заявката и отговора за отстраняване на проблеми.",
    ],
  },
  {
    title: "Макроси и автоматизация",
    image: "05-macros.png",
    bullets: [
      "Макросите са подредени последователности от HTTP стъпки към избран хост; могат да се групират в папки.",
      "Всяка стъпка задава метод, път, тяло или заглавки, закъснение и очаквания за пренасяне на данни напред.",
      "Плейсхолдери като {{step1.id}} и {{baseUrl}} връзват стъпките в повторяеми тестове или сценарии.",
      "Управлението на библиотеката става с „Нов“, „Нова папка“ и „Изтрий“ за ненужни макроси.",
    ],
  },
];

function addSlideHeader(slide, title) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.72,
    fill: { color: C.header },
    line: { color: C.header, width: 0 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.72,
    w: 0.12,
    h: 4.95,
    fill: { color: C.accent },
    line: { width: 0 },
  });
  slide.addText(title, {
    x: 0.45,
    y: 0.16,
    w: 9.2,
    h: 0.48,
    fontSize: 22,
    bold: true,
    fontFace: FONT,
    color: C.textOnDark,
    valign: "middle",
  });
}

function addFooter(slide, slideNum, totalSlides) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.45,
    y: 5.38,
    w: 9.1,
    h: 0,
    line: { color: C.footerLine, width: 0.5 },
  });
  slide.addText(DECK_TITLE, {
    x: 0.45,
    y: 5.42,
    w: 6,
    h: 0.22,
    fontSize: 9,
    fontFace: FONT,
    color: C.textMuted,
    valign: "middle",
  });
  slide.addText(`${slideNum} / ${totalSlides}`, {
    x: 8.2,
    y: 5.42,
    w: 1.35,
    h: 0.22,
    fontSize: 9,
    fontFace: FONT,
    color: C.textMuted,
    align: "right",
    valign: "middle",
  });
}

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.author = "diplomen-proekt";
pptx.subject = "Desktop REST Client — преглед на UI";
pptx.title = DECK_TITLE;

const totalSlides = 1 + 1 + slidesData.length + 1; // заглавие + съдържание + екрани + финал

/* ——— Заглавен слайд ——— */
const titleSlide = pptx.addSlide();
titleSlide.background = { color: C.header };
titleSlide.addShape(pptx.ShapeType.rect, {
  x: 1.2,
  y: 2.35,
  w: 1.35,
  h: 0.08,
  fill: { color: C.accent },
  line: { width: 0 },
});
titleSlide.addText(DECK_TITLE, {
  x: 0.6,
  y: 1.55,
  w: 8.8,
  h: 0.85,
  fontSize: 36,
  bold: true,
  fontFace: FONT,
  color: C.textOnDark,
  align: "center",
});
titleSlide.addText("Преглед на потребителския интерфейс", {
  x: 0.6,
  y: 2.55,
  w: 8.8,
  h: 0.45,
  fontSize: 18,
  fontFace: FONT,
  color: C.accent,
  align: "center",
});
titleSlide.addText(
  "Управление на устройства · Заявки · История · Макроси",
  {
    x: 0.6,
    y: 3.15,
    w: 8.8,
    h: 0.4,
    fontSize: 14,
    fontFace: FONT,
    color: "94A3B8",
    align: "center",
  },
);
titleSlide.addText("Дипломен проект", {
  x: 0.6,
  y: 4.85,
  w: 8.8,
  h: 0.35,
  fontSize: 12,
  fontFace: FONT,
  color: "64748B",
  align: "center",
});
addFooter(titleSlide, 1, totalSlides);

/* ——— Съдържание ——— */
const agendaSlide = pptx.addSlide();
agendaSlide.background = { color: C.bgSlide };
addSlideHeader(agendaSlide, "Съдържание");
const agendaItems = [
  "Списък с REST API устройства",
  "Конфигурация на устройство",
  "Единична HTTP заявка",
  "История на заявките",
  "Макроси и автоматизация",
];
const agendaText = agendaItems.map((t) => ({
  text: t,
  options: { bullet: { type: "number", color: C.accent }, breakLine: true },
}));
agendaSlide.addText(agendaText, {
  x: 0.55,
  y: 1.05,
  w: 8.9,
  h: 4.1,
  fontSize: 20,
  fontFace: FONT,
  color: C.textDark,
  valign: "top",
  lineSpacingMultiple: 1.35,
});
addFooter(agendaSlide, 2, totalSlides);

/* ——— Съдържателни слайдове: скрийншот вляво, тези вдясно ——— */
let slideNum = 3;
for (const item of slidesData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.bgSlide };
  addSlideHeader(slide, item.title);

  const imgPath = path.join(assetsDir, item.image);
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.38,
    y: 0.88,
    w: 5.45,
    h: 3.95,
    fill: { color: "FFFFFF" },
    line: { color: C.footerLine, width: 0.75 },
    rectRadius: 0.06,
  });
  slide.addImage({
    path: imgPath,
    x: 0.48,
    y: 0.98,
    w: 5.25,
    h: 3.75,
    sizing: { type: "contain", w: 5.25, h: 3.75 },
  });

  const textParts = item.bullets.map((text) => ({
    text,
    options: { bullet: { type: "bullet", color: C.accent }, breakLine: true },
  }));

  slide.addText("Какво показва екранът", {
    x: 6.05,
    y: 0.92,
    w: 3.55,
    h: 0.28,
    fontSize: 11,
    bold: true,
    fontFace: FONT,
    color: C.accent,
    valign: "middle",
  });

  slide.addText(textParts, {
    x: 6.05,
    y: 1.22,
    w: 3.55,
    h: 3.65,
    fontSize: 12,
    fontFace: FONT,
    color: C.textDark,
    valign: "top",
    lineSpacingMultiple: 1.15,
  });

  addFooter(slide, slideNum, totalSlides);
  slideNum += 1;
}

/* ——— Финален слайд ——— */
const endSlide = pptx.addSlide();
endSlide.background = { color: C.header };
endSlide.addText("Въпроси?", {
  x: 0.5,
  y: 2.15,
  w: 9,
  h: 0.9,
  fontSize: 40,
  bold: true,
  fontFace: FONT,
  color: C.textOnDark,
  align: "center",
});
endSlide.addText("Благодаря за вниманието!", {
  x: 0.5,
  y: 3.05,
  w: 9,
  h: 0.45,
  fontSize: 18,
  fontFace: FONT,
  color: "94A3B8",
  align: "center",
});
addFooter(endSlide, totalSlides, totalSlides);

await pptx.writeFile({ fileName: outFile });
console.log("Готово:", outFile);
