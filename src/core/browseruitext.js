//==============================================================================
// 브라우저 화면 글. (엔진이 그리는 질문 창의 제목과 단추 글, 러스트 판 core/browseruitext.rs 와 같은 표와 같은 로케일 고르기)
// - 글은 크로미엄의 번역(.xtb)을 grit 메시지 번호로 찾아 옮긴 러스트 판 core/browseruitext.json 의 표에서 질문 창이 쓰는 셋(page_says, ok, cancel)만 옮겼다. (로케일 82 개)
// - 로케일은 브라우저 화면 언어 자리인 navigator.languages 에서 크롬 규칙으로 고르고, 맞는 것이 없으면 en-US 다.
//==============================================================================


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: 크로미엄 generated_resources, ui_strings, components_strings 의 번역(.xtb, 로케일 82 개)에서 옮긴 글, BSD-3-Clause, THIRD_PARTY_LICENSES.md
const System = globalThis;


//==============================================================================
// 글 종류. (러스트 판 BrowserUiText 의 PageSays, Ok, Cancel)
//==============================================================================
export const BrowserUiText = System.Object.freeze({
	pageSays: 0, // 질문 창 제목. ("이 페이지 내용:")
	ok: 1, // 확인 단추.
	cancel: 2, // 취소 단추.
});


//==============================================================================
// 로케일마다 [제목, 확인, 취소].
//==============================================================================
const BROWSER_UI_TEXT_TABLE = {
	"en-US": ["This page says", "OK", "Cancel"],
	"af": ["Hierdie bladsy sê", "OK", "Kanselleer"],
	"am": ["ይህ ገፅ እንዲህ ይላል፦", "እሺ", "ይቅር"],
	"ar": ["تعرض هذه الصفحة", "حسنًا", "إلغاء"],
	"as": ["এই পৃষ্ঠাটোৱে কৈছে", "ঠিক আছে", "বাতিল কৰক"],
	"az": ["Bu səhifə deyir:", "OK", "Ləğv edin"],
	"be": ["Інфармацыя ад старонкі", "ОК", "Скасаваць"],
	"bg": ["Тази страница изпраща съобщение", "OK", "Отказ"],
	"bn": ["এই পৃষ্ঠায় এটি দেখানো হচ্ছে", "ঠিক আছে", "বাতিল"],
	"bs": ["Na ovoj stranici piše", "Uredu", "Otkaži"],
	"ca": ["Aquesta pàgina diu", "D'acord", "Cancel·la"],
	"cs": ["Tato stránka říká", "OK", "Zrušit"],
	"cy": ["Dywed y dudalen hon", "Iawn", "Canslo"],
	"da": ["Denne side siger", "OK", "Annuller"],
	"de": ["Auf dieser Seite wird Folgendes angezeigt", "OK", "Abbrechen"],
	"el": ["Αυτή η σελίδα λέει", "OK", "Ακύρωση"],
	"en-GB": ["This page says", "OK", "Cancel"],
	"es": ["Esta página dice", "Aceptar", "Cancelar"],
	"es-419": ["Esta página dice", "Aceptar", "Cancelar"],
	"et": ["Leht ütleb", "OK", "Tühista"],
	"eu": ["Orriak hau dio:", "Ados", "Utzi"],
	"fa": ["این صفحه می‌گوید", "تأیید", "لغو"],
	"fi": ["Viesti tältä sivulta", "OK", "Peru"],
	"fil": ["Isinasaad ng page na ito na", "OK", "Kanselahin"],
	"fr": ["Cette page indique", "OK", "Annuler"],
	"fr-CA": ["Cette page indique", "OK", "Annuler"],
	"gl": ["Esta páxina di", "Aceptar", "Cancelar"],
	"gu": ["આ પેજ કહે છે કે", "બરાબર, સમજાઇ ગયું", "રદ કરો"],
	"he": ["הדף הזה אומר", "אישור", "ביטול"],
	"hi": ["इस पेज का कहना है कि", "ठीक है", "अभी नहीं"],
	"hr": ["Na ovoj se stranici navodi sljedeće", "U redu", "Odustani"],
	"hu": ["Az oldal közlendője", "OK", "Mégse"],
	"hy": ["Հաղորդագրություն այս էջից", "Եղավ", "Չեղարկել"],
	"id": ["Halaman ini menyatakan", "Oke", "Batal"],
	"is": ["Þessi síða segir", "Í lagi", "Hætta við"],
	"it": ["Questa pagina dice", "Ok", "Annulla"],
	"ja": ["このページの内容", "OK", "キャンセル"],
	"ka": ["ეს გვერდი იუწყება:", "კარგი", "გაუქმება"],
	"kk": ["Бұл беттегі сұрау", "Жарайды", "Бас тарту"],
	"km": ["ទំព័រនេះ​និយាយ​ថា", "យល់ព្រម", "បដិសេធ"],
	"kn": ["ಈ ಪುಟವು ಹೀಗೆ ಹೇಳುತ್ತದೆ", "ಸರಿ", "ರದ್ದುಮಾಡಿ"],
	"ko": ["이 페이지 내용:", "확인", "취소"],
	"ky": ["Бул баракча мындай дейт:", "OK", "Жокко чыгаруу"],
	"lo": ["ໜ້ານີ້ບອກ", "ຕົກລົງ", "ຍົກ​ເລີກ​"],
	"lt": ["Šiame puslapyje nurodyta:", "Gerai", "Atšaukti"],
	"lv": ["Šajā lapā ir rakstīts", "Labi", "Atcelt"],
	"mk": ["Оваа страница вели", "Во ред", "Откажи"],
	"ml": ["ഈ പേജ് പറയുന്നത്:", "ശരി", "റദ്ദാക്കൂ"],
	"mn": ["Энэ хуудас хэлэхдээ", "OK", "Болих"],
	"mr": ["या पेजचे म्हणणे हे आहे की", "ठीक आहे", "रद्द करा"],
	"ms": ["Halaman ini menyatakan", "OK", "Batal"],
	"my": ["ဤစာမျက်နှာက ဆိုထားသည်မှာ", "OK", "မလုပ်တော့"],
	"nb": ["På denne siden står det", "OK", "Avbryt"],
	"ne": ["यो पृष्ठले यसो भन्छ", "ठिक छ", "रद्द गर्नुहोस्"],
	"nl": ["Deze pagina meldt het volgende", "OK", "Annuleren"],
	"or": ["ଏହି ପୃଷ୍ଠା ଏହା କୁହେ", "ଓକେ ବଟନ୍", "ବାତିଲ"],
	"pa": ["ਇਸ ਪੰਨੇ ਦੇ ਮੁਤਾਬਕ", "ਠੀਕ", "ਰੱਦ ਕਰੋ"],
	"pl": ["Komunikat z bieżącej strony", "OK", "Anuluj"],
	"pt-BR": ["Essa página diz", "OK", "Cancelar"],
	"pt-PT": ["Esta página diz", "OK", "Cancelar"],
	"ro": ["Această pagină afișează mesajul", "OK", "Anulează"],
	"ru": ["Подтвердите действие", "ОК", "Отмена"],
	"si": ["මෙම පිටුව කියයි", "හරි", "අවලංගු කරන්න"],
	"sk": ["Táto stránka hovorí", "OK", "Zrušiť"],
	"sl": ["Ta stran sporoča:", "V redu", "Prekliči"],
	"sq": ["Kjo faqe thotë", "Në rregull", "Anulo"],
	"sr": ["Ова страница наводи:", "Потврди", "Откажи"],
	"sr-Latn": ["Ova stranica navodi:", "Potvrdi", "Otkaži"],
	"sv": ["På den här sidan står det", "OK", "Avbryt"],
	"sw": ["Ukurasa huu unasema", "Sawa", "Ghairi"],
	"ta": ["இந்தப் பக்கம் தெரிவிப்பது:", "சரி", "ரத்து செய்"],
	"te": ["ఈ పేజీ ఇలా చెబుతోంది", "సరే", "రద్దు చేయండి"],
	"th": ["หน้านี้บอกว่า", "ตกลง", "ยกเลิก"],
	"tr": ["Bu sayfanın mesajı", "Tamam", "İptal"],
	"uk": ["Повідомлення з цієї сторінки", "OK", "Скасувати"],
	"ur": ["اس صفحے کے مطابق", "ٹھیک ہے", "منسوخ کریں"],
	"uz": ["Amalni tasdiqlang", "OK", "Bekor qilish"],
	"vi": ["Trang này cho biết", "OK", "Huỷ"],
	"zh-CN": ["此网页显示", "确定", "取消"],
	"zh-HK": ["此網頁顯示：", "確定", "取消"],
	"zh-TW": ["這個網頁顯示", "確定", "取消"],
	"zu": ["Leli khasi lithi", "KULUNGILE", "Khansela"],
};
const DEFAULT_LOCALE = "en-US";
let selectedLocale = null;


//==============================================================================
// 언어 태그 하나를 표의 로케일로. (크롬 규칙, 러스트 판 match_locale, 맞는 것이 없으면 null)
//==============================================================================
function matchLocale(languageTag) {
	const normalizedTag = System.String(languageTag).trim().replace(/_/g, "-");
	const localeList = System.Object.keys(BROWSER_UI_TEXT_TABLE);
	const findLocale = (candidate) => localeList.find((locale) => locale.toLowerCase() === candidate.toLowerCase()) || null;
	const exactLocale = findLocale(normalizedTag);
	if (exactLocale !== null) {
		return exactLocale;
	}
	const subtagList = normalizedTag.split("-").map((subtag) => subtag.toLowerCase());
	const language = subtagList[0] || "";
	const hasSubtag = (wantedSubtag) => subtagList.slice(1).includes(wantedSubtag);
	let candidate = language;
	if (language === "es") {
		candidate = subtagList.length > 1 && !hasSubtag("es") ? "es-419" : "es";
	}
	else if (language === "pt") {
		candidate = subtagList.length === 1 || hasSubtag("br") ? "pt-BR" : "pt-PT";
	}
	else if (language === "zh") {
		if (hasSubtag("hk") || hasSubtag("mo")) {
			candidate = "zh-HK";
		}
		else if (hasSubtag("hant") || hasSubtag("tw")) {
			candidate = "zh-TW";
		}
		else {
			candidate = "zh-CN";
		}
	}
	else if (language === "en") {
		const usRegionList = ["us", "ph", "lr", "pr", "vi", "as", "gu", "um", "mp"];
		candidate = subtagList.length === 1 || subtagList.slice(1).some((subtag) => usRegionList.includes(subtag)) ? "en-US" : "en-GB";
	}
	else if (language === "iw" || language === "he") {
		candidate = "he";
	}
	else if (language === "no" || language === "nb" || language === "nn") {
		candidate = "nb";
	}
	else if (language === "tl" || language === "fil") {
		candidate = "fil";
	}
	else if (language === "in" || language === "id") {
		candidate = "id";
	}
	return findLocale(candidate);
}


//==============================================================================
// 브라우저 화면 언어의 글 읽기. (러스트 판 read_browser_ui_text, 로케일은 처음 부를 때 navigator.languages 로 고른다)
//==============================================================================
/**
 * @param { number } text 글 종류. (BrowserUiText 의 값)
 * @returns { string } 화면 언어의 글. (없으면 en-US 글)
 */
export function readBrowserUiText(text) {
	if (selectedLocale === null) {
		selectedLocale = DEFAULT_LOCALE;
		const navigator = System.navigator;
		const languageTagList = navigator ? (navigator.languages && navigator.languages.length > 0 ? navigator.languages : [navigator.language || ""]) : [];
		for (const languageTag of languageTagList) {
			const locale = matchLocale(languageTag);
			if (locale !== null) {
				selectedLocale = locale;
				break;
			}
		}
	}
	for (const locale of [selectedLocale, DEFAULT_LOCALE]) {
		const textList = BROWSER_UI_TEXT_TABLE[locale];
		if (textList && textList[text]) {
			return textList[text];
		}
	}
	return "";
}
