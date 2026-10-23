"""
Laver den fiktive eksempelprøve i public/eksempel/ (opgavesæt, rettevejledning,
omsætningstabel og tre elevbesvarelser). Alle navne og svar er opdigtede.
Kør: python3 scripts/lav-eksempelproeve.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# DejaVu har π, −, ≈ og ² – standardskrifterne i PDF har ikke
FONTS = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Sans', FONTS + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Bold', FONTS + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono', FONTS + 'DejaVuSansMono.ttf'))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans', boldItalic='Sans-Bold')

UD = os.path.join(os.path.dirname(__file__), '..', 'public', 'eksempel')
os.makedirs(UD, exist_ok=True)

ss = getSampleStyleSheet()
H1 = ParagraphStyle('h1', parent=ss['Title'], fontName='Sans-Bold', fontSize=18, alignment=0, spaceAfter=4)
H2 = ParagraphStyle('h2', parent=ss['Heading2'], fontName='Sans-Bold', fontSize=13, spaceBefore=10, spaceAfter=4)
P = ParagraphStyle('p', parent=ss['BodyText'], fontName='Sans', fontSize=10.5, leading=14)
SMALL = ParagraphStyle('s', parent=P, fontSize=9, textColor=colors.HexColor('#555555'))
SVAR = ParagraphStyle('svar', parent=P, fontName='Mono', fontSize=10.5, leading=14, leftIndent=8)

TITEL = 'Terminsprøve i matematik – eksempel'
UNDER = 'Fiktiv prøve til afprøvning af AI Prøveretter. Hjælpemidler: alle. 30 point i alt.'

# (nummer, opgavetekst, korrekt svar, point, rettevejledning)
OPGAVER = [
    ('Opgave 1 – Cykelturen', None, None, None, 'Mira cykler en tur i weekenden.'),
    ('1.1', 'Mira cykler 18 km på 45 minutter. Hvad er hendes gennemsnitsfart i km/t?', '24 km/t', 2,
     '1 point for korrekt metode (fx 18 / 0,75). 1 point for korrekt resultat med enhed.'),
    ('1.2', 'En cykelhjelm koster normalt 480 kr. Den er sat 15 % ned. Hvad koster hjelmen nu?', '408 kr.', 2,
     '1 point for at beregne rabatten (72 kr.) eller bruge faktoren 0,85. 1 point for 408 kr.'),
    ('1.3', 'Hele turen er 60 km. Hvor mange procent af turen har Mira cyklet efter 18 km?', '30 %', 2,
     '1 point for 18/60. 1 point for 30 %.'),
    ('Opgave 2 – Cykeludlejning', None, None, None, 'Et udlejningsfirma tager 50 kr. i gebyr plus 25 kr. pr. time.'),
    ('2.1', 'Løs ligningen 3x + 7 = 31.', 'x = 8', 2, '1 point for korrekt mellemregning. 1 point for x = 8.'),
    ('2.2', 'Skriv en forskrift for prisen y i kr. for at leje en cykel i x timer, og beregn prisen for 4 timer.', 'y = 25x + 50; 150 kr.', 3,
     '2 point for forskriften y = 25x + 50 (1 point hvis kun hældning eller gebyr er rigtig). 1 point for 150 kr. Følgefejl godkendes.'),
    ('2.3', 'Hvor mange timer kan man leje en cykel for 300 kr.?', '10 timer', 2,
     '1 point for at opstille 25x + 50 = 300 eller tilsvarende. 1 point for 10 timer. Følgefejl fra 2.2 godkendes.'),
    ('Opgave 3 – Haven', None, None, None, 'Familien vil anlægge et blomsterbed.'),
    ('3.1', 'Et rektangulært bed er 6 m langt og 4,5 m bredt. Beregn bedets areal.', '27 m²', 2, '1 point for 6 · 4,5. 1 point for 27 m² med enhed.'),
    ('3.2', 'Beregn bedets omkreds.', '21 m', 2, '1 point for metode. 1 point for 21 m.'),
    ('3.3', 'Et rundt bed har en radius på 3 m. Beregn arealet.', 'ca. 28,3 m²', 3,
     '1 point for formlen π · r². 1 point for korrekt indsættelse. 1 point for ca. 28,3 m² (28 eller 28,27 godkendes).'),
    ('Opgave 4 – Statistik og sandsynlighed', None, None, None, 'Fem elever har talt, hvor mange gange de har cyklet i skole på en måned: 4, 7, 7, 9 og 13.'),
    ('4.1', 'Man slår med en almindelig terning. Hvad er sandsynligheden for at slå 5 eller 6?', '1/3 (ca. 33 %)', 2, '1 point for 2/6. 1 point for forkortet eller som procent.'),
    ('4.2', 'Beregn middelværdien af tallene.', '8', 2, '1 point for summen 40 / 5. 1 point for 8.'),
    ('4.3', 'Bestem medianen.', '7', 2, '2 point for 7. 1 point hvis tallene er sorteret, men medianen er forkert.'),
    ('4.4', 'Bestem typetallet.', '7', 1, '1 point for 7.'),
    ('4.5', 'Forklar, hvorfor medianen ikke ændres, hvis 13 udskiftes med 20.', 'Medianen er den midterste værdi; den er stadig 7.', 3,
     '3 point for en forklaring, der bruger, at medianen er den midterste værdi i den sorterede række, og at den største værdi ikke flytter midten. 1–2 point for en delvis forklaring.'),
]

def doc(navn, story):
    d = SimpleDocTemplate(os.path.join(UD, navn), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=18*mm, bottomMargin=18*mm,
                          title=navn.replace('.pdf', ''), author='AI Prøveretter (eksempel)')
    d.build(story)

# ---------- Opgavesæt ----------
s = [Paragraph(TITEL, H1), Paragraph(UNDER, SMALL), Spacer(1, 8)]
for nr, tekst, svar, point, ekstra in OPGAVER:
    if tekst is None:
        s += [Paragraph(nr, H2), Paragraph(ekstra, P), Spacer(1, 4)]
    else:
        s += [Paragraph(f'<b>{nr}</b>&nbsp;&nbsp;{tekst} <font color="#777">({point} point)</font>', P), Spacer(1, 6)]
doc('opgavesaet.pdf', s)

# ---------- Rettevejledning ----------
s = [Paragraph(f'Rettevejledning – {TITEL.lower()}', H1), Paragraph('30 point i alt. Følgefejl giver point for den del, der er udført korrekt. Ligeværdige svar (brøk, decimaltal, procent) godkendes.', SMALL), Spacer(1, 8)]
rows = [['Opgave', 'Korrekt svar', 'Point', 'Pointgivning']]
for nr, tekst, svar, point, ekstra in OPGAVER:
    if tekst is None:
        continue
    rows.append([nr, Paragraph(svar, P), str(point), Paragraph(ekstra, P)])
rows.append(['I alt', '', '30', ''])
t = Table(rows, colWidths=[18*mm, 45*mm, 14*mm, 93*mm], repeatRows=1)
t.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, 0), 'Sans-Bold', 9.5), ('FONT', (0, 1), (-1, -1), 'Sans', 10),
    ('FONT', (0, -1), (-1, -1), 'Sans-Bold', 10), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.black), ('LINEBELOW', (0, 1), (-1, -2), 0.3, colors.HexColor('#cccccc')),
    ('LINEABOVE', (0, -1), (-1, -1), 0.8, colors.black), ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
]))
s.append(t)
doc('rettevejledning.pdf', s)

# ---------- Omsætningstabel ----------
TABEL = [(12, 27, 30), (10, 23, 26), (7, 17, 22), (4, 12, 16), (2, 8, 11), (0, 3, 7), (-3, 0, 2)]
s = [Paragraph(f'Omsætningstabel – {TITEL.lower()}', H1), Paragraph('Karakter ud fra samlet antal point (0–30).', SMALL), Spacer(1, 8)]
rows = [['Karakter', 'Point fra', 'Point til']] + [[('00' if k == 0 else '02' if k == 2 else str(k)), str(a), str(b)] for k, a, b in TABEL]
t = Table(rows, colWidths=[30*mm, 30*mm, 30*mm])
t.setStyle(TableStyle([('FONT', (0, 0), (-1, 0), 'Sans-Bold', 10), ('FONT', (0, 1), (-1, -1), 'Sans', 11),
                       ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.black), ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                       ('LINEBELOW', (0, 1), (-1, -1), 0.3, colors.HexColor('#cccccc'))]))
s.append(t)
doc('omsaetningstabel.pdf', s)

# ---------- Elevbesvarelser (fiktive) ----------
ELEVER = [
    (1, 'Sofie Fiktivsen', {
        '1.1': '45 min = 0,75 time. 18 / 0,75 = 24 km/t',
        '1.2': '480 · 0,85 = 408 kr.',
        '1.3': '18 / 60 = 0,3 = 30 %',
        '2.1': '3x = 31 − 7 = 24, x = 24 / 3 = 8',
        '2.2': 'y = 25x + 50. For 4 timer: 25 · 4 + 50 = 150 kr.',
        '2.3': '25x + 50 = 300 → 25x = 250 → x = 10 timer',
        '3.1': '6 · 4,5 = 27 m²',
        '3.2': '2 · 6 + 2 · 4,5 = 21 m',
        '3.3': 'π · 3² = 28,27',
        '4.1': '2/6 = 1/3 ≈ 33 %',
        '4.2': '(4+7+7+9+13)/5 = 40/5 = 8',
        '4.3': '4, 7, 7, 9, 13 → medianen er 7',
        '4.4': '7',
        '4.5': 'Medianen er det midterste tal når tallene står i rækkefølge. Hvis 13 bliver til 20 er det stadig det største tal, så det midterste tal er stadig 7.',
    }),
    (2, 'Jonas Opdigtet', {
        '1.1': '18 / 45 = 0,4 km/t',
        '1.2': '15 % af 480 = 72 kr.',
        '1.3': '18 / 60 = 0,3 %',
        '2.1': '3x + 7 = 31, x = 8',
        '2.2': 'y = 50x + 25. 4 timer: 50 · 4 + 25 = 225 kr.',
        '2.3': '300 − 25 = 275, 275 / 50 = 5,5 timer',
        '3.1': '6 · 4,5 = 27',
        '3.2': '6 + 4,5 = 10,5 m',
        '3.3': 'π · 6² = 113 m²',
        '4.1': '1/6',
        '4.2': '40 / 5 = 8',
        '4.3': '7',
        '4.4': '7',
        '4.5': 'Fordi 13 og 20 begge er store.',
    }),
    (3, 'Mads Testesen', {
        '1.1': '18 km',
        '1.2': '480 − 15 = 465 kr.',
        '1.3': '',
        '2.1': 'x = 31',
        '2.2': '',
        '2.3': '',
        '3.1': '6 · 4,5 = 27 m²',
        '3.2': '',
        '3.3': '',
        '4.1': '50 %',
        '4.2': '8',
        '4.3': '9',
        '4.4': '7',
        '4.5': 'Det ved jeg ikke.',
    }),
]
for nr, navn, svar in ELEVER:
    s = [Paragraph(f'Navn: {navn}&nbsp;&nbsp;&nbsp;&nbsp;Klasse: 9.X&nbsp;&nbsp;&nbsp;&nbsp;Elevnummer: {nr}', P),
         Spacer(1, 6), Paragraph(TITEL, H2), Paragraph('Fiktiv besvarelse – alle navne er opdigtede.', SMALL), Spacer(1, 6)]
    for onr, tekst, _, _, _ in OPGAVER:
        if tekst is None:
            continue
        s.append(KeepTogether([Paragraph(f'<b>{onr}</b>', P), Paragraph(svar.get(onr) or '(ikke besvaret)', SVAR), Spacer(1, 7)]))
    doc(f'besvarelse-elev-{nr}.pdf', s)

print('Eksempelprøven er lavet i', os.path.abspath(UD))
