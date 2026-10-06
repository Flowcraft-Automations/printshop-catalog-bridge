# integrations/

חיבור לכל מערכת חיצונית: `<provider>.json`, וכשמשווים נתונים גם `<provider>.mapping.json`.

- לכל סביבה רמת גישה: `read`, `sandbox` או `mock`. פעולת כתיבה רצה רק ב-`sandbox` או ב-`mock`.
- סוד נרשם **בשם בלבד**, שם ה-secret ב-CI. ערך של סוד אינו נכתב לשום קובץ.

ריקה עד החיבור הראשון.
