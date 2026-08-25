-- ================================================================
-- 2026-08-25 — app-DB worklist (רשימת עבודה למסד המעקב של האפליקציה)
--
-- עברית:
--   הקובץ מעדכן אך ורק את מסד המעקב של האפליקציה (טבלת products) — הוא
--   אינו נוגע בסנזיי או באתר. לכל פריט מאושר הוא קובע final_price (המחיר
--   שהוחלט) ומעדכן senzey_status / site_status כך שלוח ההגירה (רשימת
--   הגירה) יעקוב אחרי העריכות הידניות שיש לבצע בסנזיי ובאתר.
--   להריץ רק אחרי סקירת דוח ה-dry-run (reports/dry-run-2026-08-25.csv)
--   ודרך Lovable / עורך ה-SQL של Supabase. בלוקים מוערים = ממתינים
--   להחלטת לקוח — אין להסיר הערה בלי אישור.
--
-- English:
--   UPDATE-only against the APP tracking DB (public.products). It never
--   touches Senzey or the site. For every approved change it sets
--   final_price (the decided price) and flips senzey_status/site_status
--   so the app's migration board tracks the manual edits still to be
--   performed by hand in Senzey / on the site. Run ONLY after reviewing
--   the dry-run report, via Lovable / the Supabase SQL editor.
--   Commented blocks await an explicit client decision.
--
--   Statuses: 'to_add' = manual edit pending in that system;
--             'not_relevant' = SKU is to be removed / ignored there.
--   Every statement is keyed by row_key; the senzey id rides in a comment.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- §A — comma-bug qty fixes (app-owned data errors; importer read
--       "10,000"/"10.000" as 1/10). Quantity corrections only.
-- ----------------------------------------------------------------

-- senzey 321 — כרטיסי ביקור 10.000 יחי → qty 10000
UPDATE public.products SET qty = 10000
WHERE row_key = 'כרטיסי ביקור 10.000 יחי';

-- senzey 322 — כרטיסי ביקור 20.000 יחי → qty 20000
UPDATE public.products SET qty = 20000
WHERE row_key = 'כרטיסי ביקור 20.000 יחי';

-- senzey 1061 — הדפסה על מגנט 10/10 10,000 יח → qty 10000
UPDATE public.products SET qty = 10000
WHERE row_key = 'הדפסה על מגנט 10/10 10,000 יח';

-- senzey 499 — 12/9 10.000 יחידות הדפסה על מגנט → qty 10000
UPDATE public.products SET qty = 10000
WHERE row_key = '12/9 10.000 יחידות הדפסה על מגנט';

-- senzey 514 — 15.000 אלף 10/8 מגנט → qty 15000
UPDATE public.products SET qty = 15000
WHERE row_key = '15.000 אלף 10/8 מגנט 5/9magnetbusiness';

-- senzey 160 — 10.000 גלויות 10/15 → qty 10000
UPDATE public.products SET qty = 10000
WHERE row_key = '10.000 גלויות 10/15';

-- הערה: מזהי סנזיי 92 / 1050 / 1051 / 585 שבמפרט אינם מופיעים בעמודת
-- senzey_ids בסנפשוט (מרחב מזהים של ממשק הניהול בסנזיי) — הרשומות אותרו
-- לפי שם. אין שורות נוספות עם באג הפסיקים בסנפשוט.

-- ----------------------------------------------------------------
-- §B — פליירים (עקומת A5 מאושרת)
-- ----------------------------------------------------------------

-- senzey 351 — פליירים 15/21 × 200: ‏₪232 → ₪125 (מחיר ספק מאושר)
UPDATE public.products
SET final_price = 125, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'פליירים 15/21 דו או חד צדדי 200 יחי';

-- senzey 417 — פליירים 15/21 × 300: ‏₪348 → ₪170 (מחיר ספק מאושר)
UPDATE public.products
SET final_price = 170, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'פליירים 15/21 דו או חד צדדי 300 יחי';

-- senzey 356 — פליירים 15/21 × 400: המפרט מוחק את המק״ט.
-- מחיקה ידנית בסנזיי/באתר.
UPDATE public.products
SET senzey_status = 'not_relevant', site_status = 'not_relevant'
WHERE row_key = 'פליירים 15/21 דו או חד צדדי 400 יחי';

-- שורת ה"10.000" היתומה (קיימת רק באתר, ₪1,093; אין מזהה סנזיי) —
-- ממתין לאישור המשתמש אם למחוק או לתמחר לפי העקומה (10,000 → ₪1,093 ✓):
-- UPDATE public.products
-- SET final_price = 1093, qty = 10000, site_status = 'to_add'
-- WHERE row_key = 'פליירים 15/21 דו או חד צדדי 10.000 יחי';

-- ----------------------------------------------------------------
-- §C — מדבקות (סולם 5×9 מאושר + מדרגות 1000 + מלבנים גדולים)
-- ----------------------------------------------------------------

-- סולם 5×9 (דלי 126): 100→126 · 150→134 · 200→143 · 250→157 · 500→174 · 1000→245
-- senzey 1151 — 5×9 × 100: ‏₪154 → ₪126
UPDATE public.products
SET final_price = 126, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ';

-- senzey 1153 — 5×9 × 150: ‏₪163 → ₪134
UPDATE public.products
SET final_price = 134, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q150';

-- senzey 1154 — 5×9 × 200: ‏₪179 → ₪143
UPDATE public.products
SET final_price = 143, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q200';

-- senzey 1155 — 5×9 × 250: ‏₪199 → ₪157
UPDATE public.products
SET final_price = 157, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q250';

-- senzey 1156 — 5×9 × 500: ‏₪280 → ₪174
UPDATE public.products
SET final_price = 174, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q500';

-- senzey 1152 — 5×9 × 1000: ‏₪420 → ₪245
UPDATE public.products
SET final_price = 245, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q1000';

-- senzey 1140 — 6×6 × 500: ‏₪270 → ₪249 (תיקון נתונים מאושר)
UPDATE public.products
SET final_price = 249, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 6-6 סמ-q500';

-- senzey 1169 — 9×9 × 1000: ‏₪505 → ₪420 (תיקון נתונים מאושר)
UPDATE public.products
SET final_price = 420, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת-מדבקות-בעיצוב-אישי-עם-הלוגו-שלכם-קוטר-9-9-ס''מ-500-יחי-1786216738040';

-- מדרגות 1000 מאושרות
-- senzey 1141 — 3 ס״מ × 1000: ‏₪315 → ₪299
UPDATE public.products
SET final_price = 299, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 3-3 סמ-q1000';

-- senzey 1142 — 4 ס״מ × 1000: ‏₪330 → ₪310
UPDATE public.products
SET final_price = 310, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 4-4 סמ-q1000';

-- (5 ס״מ × 1000 כבר ב-₪345 — אין שינוי)

-- ללא מזהה סנזיי בסנפשוט — 6×6 × 1000: ‏₪485 → ₪370
UPDATE public.products
SET final_price = 370, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 6-6 סמ-q1000';

-- senzey 1158 — 7 ס״מ × 1000: ‏₪495 → ₪395
UPDATE public.products
SET final_price = 395, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 7-7 סמ-q1000';

-- senzey 1164 — 8 ס״מ × 1000: ‏₪495 → ₪395
UPDATE public.products
SET final_price = 395, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 8-8 סמ-q1000';

-- senzey 1181 — 10 ס״מ × 1000: ‏₪590 → ₪480
UPDATE public.products
SET final_price = 480, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-10 סמ-q1000';

-- מלבנים גדולים 24×6 / 10×15: ‏500 → ₪375 · 1000 → ₪595
-- senzey 1190 — 24×6 × 500: ‏₪340 → ₪375
UPDATE public.products
SET final_price = 375, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 24-6 סמ-q500';

-- senzey 1186 — 24×6 × 1000: ‏₪590 → ₪595
UPDATE public.products
SET final_price = 595, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 24-6 סמ-q1000';

-- senzey 1195 — 10×15 × 500: ‏₪340 → ₪375
UPDATE public.products
SET final_price = 375, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-15 סמ-q500';

-- senzey 1193 — 10×15 × 1000: ‏₪590 → ₪595
UPDATE public.products
SET final_price = 595, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-15 סמ-q1000';

-- ----------------------------------------------------------------
-- §D — קנבס (הוזלות/העלאות מאושרות + איחודים)
-- ----------------------------------------------------------------

-- senzey 5 — קנבס 30/30: ‏₪99 → ₪95
UPDATE public.products
SET final_price = 95, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 30/30';

-- senzey 7 — קנבס 30/45: ‏₪105 → ₪110
UPDATE public.products
SET final_price = 110, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 30/45';

-- senzey 119 — קנבס 50/30: ‏₪110 → ₪115
UPDATE public.products
SET final_price = 115, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 50/30';

-- senzey 17 — קנבס 60/180: ‏₪425 → ₪365
UPDATE public.products
SET final_price = 365, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 60/180';

-- senzey 431 — קנבס 90/90: ‏₪225 → ₪230
UPDATE public.products
SET final_price = 230, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 90/90';

-- senzey 21 — קנבס 80/120: ‏₪240 → ₪255
UPDATE public.products
SET final_price = 255, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 80/120';

-- senzey 22 — קנבס 90/120: ‏₪261 → ₪280
UPDATE public.products
SET final_price = 280, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 90/120';

-- senzey 436 — קנבס 70/100 (=100/70): ‏₪215 → ₪245 (איחוד 100/70+70/100)
UPDATE public.products
SET final_price = 245, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על קנבס 70/100';

-- senzey 147 — קנבס 50/40: כבר ₪140 בשתי המערכות — קובעים מחיר סופי בלבד
UPDATE public.products SET final_price = 140
WHERE row_key = 'הדפסת על קנבס 50/40';

-- senzey 202 — קנבס 20/20: כבר ₪59 בשתי המערכות — קובעים מחיר סופי בלבד
UPDATE public.products SET final_price = 59
WHERE row_key = 'הדפסה על קנבס 20/20';

-- איחודים (הערות בלבד — בסנפשוט קיימת שורה אחת לכל מידה):
--   140/70 ↔ 70/140 = ₪281 — בסנפשוט רק 'הדפסה על קנבס 70/140' (senzey 434,
--   ₪281, מקושרת לאתר) — אין כפילות למחוק; אם תופיע שורה שנייה בסנזיי:
--   לשמור את המקושרת לאתר ולסמן את השנייה not_relevant.
--   40/60 ↔ 60/40 — בסנפשוט רק 'הדפסה על קנבס 40/60' (senzey 11) — אין כפילות.

-- ----------------------------------------------------------------
-- §E — שמשונית (נקודות מאושרות 120/80=₪90 · 120/100=₪105)
-- ----------------------------------------------------------------

-- senzey 633 — כפילות 120/100 ב-₪80 (ללא אתר): מחיקה ידנית בסנזיי
UPDATE public.products
SET senzey_status = 'not_relevant', site_status = 'not_relevant'
WHERE row_key = 'הדפסה על שמשונית 120/100';

-- senzey 794 — שמשונית 120/80 = ₪90 — נקודת עוגן מאושרת (SPEC_ANCHOR).
-- מסמנים את השורה האמיתית כעוגן מאומת; המיגרציה זורעת גם שורת עוגן
-- עצמאית (anchor-שמשונית-120x80-1) כגיבוי — עדיף העוגן על השורה האמיתית.
UPDATE public.products
SET final_price = 90, verified = true, is_anchor = true
WHERE row_key = 'הדפסה על שמשונית 120/80 סמ';

-- senzey 796 — שמשונית 120/100 = ₪105 — נקודת עוגן מאושרת (SPEC_ANCHOR).
UPDATE public.products
SET final_price = 105, verified = true, is_anchor = true
WHERE row_key = 'הדפסה על שמשונית 120/100 סמ';

-- ----------------------------------------------------------------
-- §F — פוליגל
-- ----------------------------------------------------------------

-- senzey 809 — פוליגל 120/80: ‏₪70 → ₪85 (ביטול ה-₪70)
UPDATE public.products
SET final_price = 85, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסה על פוליגל 120/80 סמ';

-- senzey 948 — חבילת 40/40 × 10 = ₪295: קונפליקט מול חבילת שמשונית ₪465.
-- ממתין להחלטת לקוח — שתי האפשרויות:
-- אפשרות 1 — להשאיר ₪295:
-- UPDATE public.products SET final_price = 295
-- WHERE row_key = 'הדפסה על פוליגל 40/40 סמ 10 יחי';
-- אפשרות 2 — ליישר ל-₪320–340 (אמצע: ₪330):
-- UPDATE public.products
-- SET final_price = 330, senzey_status = 'to_add', site_status = 'to_add'
-- WHERE row_key = 'הדפסה על פוליגל 40/40 סמ 10 יחי';

-- ----------------------------------------------------------------
-- §G — חשבוניות / פנקסים (מחיר מבנה אחיד: A5×10=₪320 · A4×10=₪418 · A4×20=₪858)
-- ----------------------------------------------------------------

-- senzey 676 — הזמנת עבודה A5 × 10: ‏₪280 → ₪320
UPDATE public.products
SET final_price = 320, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הזמנת עבודה A5 עשר פנקסים מקור + 2 העתקים';

-- senzey 64 — תעודת משלוח A5 × 10 (סנזיי בלבד): ‏₪323 → ₪320
UPDATE public.products
SET final_price = 320, senzey_status = 'to_add'
WHERE row_key = 'תעודת משלוח A5 עשרה פנקסים';

-- senzey 69 — קבלת עוסק פטור A4 × 10 (סנזיי בלבד): ‏₪442 → ₪418
UPDATE public.products
SET final_price = 418, senzey_status = 'to_add'
WHERE row_key = 'קבלת עוסק פטור A4 עשרה פנקסים';

-- כבר במחיר הנכון — קובעים final_price בלבד (ללא עריכה ידנית):
-- senzey 674 — חשבונית מס / קבלה A5 × 10 = ₪320
UPDATE public.products SET final_price = 320
WHERE row_key = 'חשבונית מס / קבלה A5 עשר פנקסים מקור + 2 העתקים';
-- senzey 673 — חשבונית מס A5 × 10 = ₪320
UPDATE public.products SET final_price = 320
WHERE row_key = 'חשבונית מס A5 עשר פנקסים מקור + 2 העתקים';
-- senzey 672 — חשבונית עסקה A5 × 10 = ₪320
UPDATE public.products SET final_price = 320
WHERE row_key = 'חשבונית עסקה A5 עשר פנקסים מקור + 2 העתקים';
-- senzey 656 — קבלות A5 × 10 = ₪320
UPDATE public.products SET final_price = 320
WHERE row_key = 'קבלות A5 עשר פנקסים מקור + 2 העתקים';
-- senzey 675 — חשבונית מס / קבלה A4 שישיות × 10 = ₪418
UPDATE public.products SET final_price = 418
WHERE row_key = 'חשבונית מס / קבלה A4 שישיות עשר פנקסים מקור + 2 העתקים';
-- senzey 986 — 10 פנקסים יומן עבודה A4 = ₪418
UPDATE public.products SET final_price = 418
WHERE row_key = '10 פנקסים יומן עבודה A4 מקור + 2 העתקים,';

-- הערה: מבנה A4 × 20 = ₪858 — אין שורה תואמת בסנפשוט; המחיר חי בתצורת
-- המשפחה (format_prices) וישמש כשה-SKU ייווצר.

-- הצעות מחיר A5 × 10 — מוצר חדש מאושר (₪320). הוספה ידנית בסנזיי ובאתר.
-- (INSERT יחיד וממוגן — חריג מכוון לכלל ה-UPDATE-only.)
INSERT INTO public.products
  (row_key, name, family, width_cm, height_cm, qty, final_price, senzey_status, site_status, source)
SELECT 'הצעות מחיר A5 עשר פנקסים מקור + 2 העתקים',
       'הצעות מחיר A5 עשר פנקסים מקור + 2 העתקים',
       'חשבוניות', 14.8, 21, 10, 320, 'to_add', 'to_add', 'cleanup'
WHERE NOT EXISTS (
  SELECT 1 FROM public.products
  WHERE row_key = 'הצעות מחיר A5 עשר פנקסים מקור + 2 העתקים'
);

-- ----------------------------------------------------------------
-- §H — זכוכית
-- ----------------------------------------------------------------

-- senzey 168 — זכוכית 120/80: ‏₪850 → ₪1,035 (שיא השוק — מאושר)
UPDATE public.products
SET final_price = 1035, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת תמונות על זכוכית בעיצוב אישי 120/80';

-- senzey 403 — זכוכית 100/70: ‏₪800 → ₪675 (יעד מאושר 650–700)
UPDATE public.products
SET final_price = 675, senzey_status = 'to_add', site_status = 'to_add'
WHERE row_key = 'הדפסת תמונות על זכוכית בעיצוב אישי 100/70';

-- senzey 24 — זכוכית 20/30: קונפליקט — במערכת ₪130, המפרט אומר "20/30 = ₪160
-- נשמר". ממתין להחלטת לקוח (להשאיר 130 או להעלות ל-160):
-- UPDATE public.products
-- SET final_price = 160, senzey_status = 'to_add', site_status = 'to_add'
-- WHERE row_key = 'הדפסת תמונות על זכוכית בעיצוב אישי 20/30';

-- ----------------------------------------------------------------
-- §I — שלטי PVC
-- ----------------------------------------------------------------

-- הערה בלבד: כפילות 80/200 (מזהי סנזיי 754/760, ‏₪754/₪760 לפי המפרט) —
-- אינה מופיעה בסנפשוט הקטלוג. יש לאמת ישירות בסנזיי ולמחוק שם את הכפולה;
-- מחיר הסולם המאושר ל-80/200 הוא ₪350.

COMMIT;

-- ================================================================
-- אימות (להרצה ידנית אחרי ה-COMMIT; מוער בכוונה)
-- ================================================================
-- §A: SELECT row_key, qty FROM public.products
--     WHERE row_key IN ('כרטיסי ביקור 10.000 יחי','כרטיסי ביקור 20.000 יחי',
--       'הדפסה על מגנט 10/10 10,000 יח','12/9 10.000 יחידות הדפסה על מגנט',
--       '15.000 אלף 10/8 מגנט 5/9magnetbusiness','10.000 גלויות 10/15');
-- §B: SELECT row_key, final_price, senzey_status, site_status
--     FROM public.products WHERE family = 'פליירים' AND final_price IS NOT NULL;
-- §C: SELECT row_key, qty, final_price FROM public.products
--     WHERE family = 'מדבקות' AND final_price IS NOT NULL ORDER BY width_cm, qty;
-- §D: SELECT row_key, final_price FROM public.products
--     WHERE family = 'קנבס' AND final_price IS NOT NULL;
-- §E: SELECT row_key, final_price, verified, is_anchor, senzey_status
--     FROM public.products WHERE family = 'שמשונית'
--       AND (is_anchor OR senzey_status = 'not_relevant');
-- §F: SELECT row_key, final_price FROM public.products WHERE family = 'פוליגל';
-- §G: SELECT row_key, final_price FROM public.products
--     WHERE family IN ('חשבוניות','פנקסים');
-- §H: SELECT row_key, final_price FROM public.products WHERE family = 'זכוכית';
