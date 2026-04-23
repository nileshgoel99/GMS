"""Generate PI PDF (ReportLab) — letterhead, company branding, watermark, footer."""

from decimal import Decimal
from io import BytesIO
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .numwords import usd_amount_to_words

DEFAULT_PAYMENT = '20% ADVANCE, REMAINING 80% AGAINST SHIPMENT DOCUMENTS'
DEFAULT_OUR_BANK = (
    'PUNJAB NATIONAL BANK, BIRHANA ROAD, KANPUR, A/C NO 188200UD00000066, SWIFT NO- PUNBINBBCKH'
)
DEFAULT_INTERMEDIARY = (
    'CITI BANK NA, 11 WALL STREET, INDIAN SERVICE MGMT CENTRE, NEW YORK, NY 11043, USA, SWIFT – CITIUS33'
)

TEAL = colors.HexColor('#0f766e')
TEAL_DARK = colors.HexColor('#0d5c56')
SLATE = colors.HexColor('#1e293b')
SLATE_MUTED = colors.HexColor('#64748b')
RULE = colors.HexColor('#cbd5e1')
TABLE_HEAD = colors.HexColor('#ecfdf5')
TABLE_HEAD_TEXT = colors.HexColor('#134e4a')
TABLE_GRID = colors.HexColor('#94a3b8')


def _fmt_size_breakdown(size_breakdown, qty_pcs: int) -> str:
    rows = size_breakdown or []
    parts = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sz = str(row.get('size') or '').strip()
        q = int(row.get('qty') or 0)
        if sz or q:
            parts.append(f'{sz} / {q}' if sz else str(q))
    if parts:
        return ', '.join(parts) + f' = {qty_pcs} PCS'
    return f'{qty_pcs} PCS'


def _esc(s: str) -> str:
    return (s or '').replace('&', '&amp;').replace('<', '&lt;')


def _company_address_block(company) -> str:
    if not company:
        return ''
    lines = [
        company.address_line1,
        company.address_line2,
        ' '.join(filter(None, [company.postal_code or '', company.city or ''])).strip(),
        ' '.join(filter(None, [company.region_state or '', company.country or ''])).strip(),
    ]
    return '<br/>'.join(_esc(x) for x in lines if (x or '').strip())


def _company_contact_lines(company) -> str:
    if not company:
        return ''
    bits = []
    if company.phone:
        bits.append(f'Tel: {_esc(company.phone)}')
    if company.fax:
        bits.append(f'Fax: {_esc(company.fax)}')
    if company.email:
        bits.append(f'Email: {_esc(company.email)}')
    if company.website:
        bits.append(_esc(company.website))
    return '<br/>'.join(bits)


def _make_page_canvas(company):
    """Watermark + footer on every page."""

    def draw(canvas, doc):
        W, H = A4
        canvas.saveState()
        if company:
            wm = (company.watermark_text or company.legal_name or '').strip()
            if wm:
                canvas.setFont('Helvetica-Bold', 32)
                canvas.setFillColor(colors.Color(0.06, 0.28, 0.26, alpha=0.06))
                canvas.translate(W / 2, H / 2)
                canvas.rotate(36)
                canvas.drawCentredString(0, 0, wm[:44].upper())
        canvas.restoreState()

        canvas.saveState()
        foot = ''
        if company:
            foot = (company.pdf_footer_note or '').strip()
            if not foot:
                foot = ' · '.join(
                    [x for x in [company.legal_name, company.phone, company.email] if (x or '').strip()]
                )
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(SLATE_MUTED)
        y = 0.75 * cm
        if foot:
            canvas.drawString(1.5 * cm, y, foot[:220])
        canvas.drawRightString(W - 1.5 * cm, y, f'Page {canvas.getPageNumber()}')
        canvas.restoreState()

    return draw


def build_pi_pdf_bytes(pi, company=None) -> bytes:
    from company.models import CompanyProfile

    if company is None:
        company = CompanyProfile.get_solo()

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=1.35 * cm,
        leftMargin=1.35 * cm,
        topMargin=1.35 * cm,
        bottomMargin=1.45 * cm,
        title=f'PI-{pi.pi_number}',
    )
    styles = getSampleStyleSheet()
    title_doc = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=11,
        textColor=colors.white,
        spaceAfter=2,
        leading=13,
        alignment=2,
        fontName='Helvetica-Bold',
    )
    meta_right = ParagraphStyle(
        'MetaRight',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.white,
        leading=12,
        alignment=2,
    )
    h2 = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontSize=10,
        spaceBefore=8,
        spaceAfter=4,
        textColor=TEAL_DARK,
        fontName='Helvetica-Bold',
    )
    body = ParagraphStyle('Body', parent=styles['Normal'], fontSize=9, leading=12, textColor=SLATE)
    small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, leading=10, textColor=SLATE_MUTED)
    letter_name = ParagraphStyle(
        'LetterName',
        parent=styles['Normal'],
        fontSize=11,
        leading=13,
        textColor=SLATE,
        fontName='Helvetica-Bold',
    )
    letter_sub = ParagraphStyle(
        'LetterSub',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=SLATE_MUTED,
    )

    story = []

    # —— Letterhead row: logo | company | doc title ——
    logo_flow = Spacer(2.6 * cm, 0.1 * cm)
    if company and company.logo and company.logo.name:
        path = company.logo.path
        if os.path.isfile(path):
            try:
                logo_flow = RLImage(path, width=2.5 * cm, height=2.5 * cm, kind='proportional')
            except OSError:
                pass

    left_stack = [
        Paragraph(_esc(company.legal_name if company else ''), letter_name),
    ]
    if company and (company.trading_name or '').strip():
        left_stack.append(Paragraph(f'<i>{_esc(company.trading_name)}</i>', letter_sub))
    if company and (company.tagline or '').strip():
        left_stack.append(Paragraph(_esc(company.tagline), letter_sub))
    addr = _company_address_block(company)
    if addr:
        left_stack.append(Spacer(1, 0.12 * cm))
        left_stack.append(Paragraph(addr, small))
    contact = _company_contact_lines(company)
    if contact:
        left_stack.append(Spacer(1, 0.1 * cm))
        left_stack.append(Paragraph(contact, small))
    if company and (company.tax_registration or '').strip():
        left_stack.append(Spacer(1, 0.08 * cm))
        left_stack.append(Paragraph(f'<b>Tax / ID:</b> {_esc(company.tax_registration)}', small))

    left_cell = Table([[p] for p in left_stack], colWidths=[11.2 * cm])
    left_cell.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))

    right_block = Table(
        [
            [Paragraph('PROFORMA INVOICE', title_doc)],
            [Paragraph(f'<b>No.</b> {_esc(pi.pi_number)}', meta_right)],
            [Paragraph(f'<b>Date</b> {pi.order_date}', meta_right)],
            [Paragraph(f'<b>Buyer PO</b> {_esc(pi.buyer_po_number or "—")}', meta_right)],
        ],
        colWidths=[6.2 * cm],
    )
    right_block.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, -1), TEAL),
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 0.5, TEAL_DARK),
            ]
        )
    )

    head = Table([[logo_flow, left_cell, right_block]], colWidths=[2.8 * cm, 11.2 * cm, 6.2 * cm])
    head.setStyle(
        TableStyle(
            [
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('LINEABOVE', (0, 0), (-1, 0), 3, TEAL),
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#f8fafc')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(head)
    story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph('<b>Bill to (TO)</b>', h2))
    story.append(Paragraph(_esc(pi.client_name), body))
    addr_c = _esc(pi.client_address or '').replace('\n', '<br/>')
    if addr_c:
        story.append(Paragraph(addr_c, small))
    if pi.client_email:
        story.append(Paragraph(f'Email: {_esc(pi.client_email)}', small))
    if pi.client_phone:
        story.append(Paragraph(f'Tel: {_esc(pi.client_phone)}', small))
    story.append(Spacer(1, 0.25 * cm))

    pay = (pi.payment_terms_display or '').strip() or DEFAULT_PAYMENT
    dispatch = (pi.date_of_dispatch_display or '').strip()
    port = (pi.port_of_discharge or '').strip()
    story.append(Paragraph(f'<b>DATE OF DISPATCH</b> : {_esc(dispatch) or "—"}', body))
    story.append(Paragraph(f'<b>PAYMENT TERMS</b> : {_esc(pay)}', body))
    if port:
        story.append(Paragraph(f'<b>PORT OF DISCHARGE</b> : {_esc(port)}', body))
    story.append(Spacer(1, 0.2 * cm))

    table_data = [['#', 'Style / item', 'Description & sizes', 'Qty', 'FOB USD', 'Value USD']]
    total_qty = 0
    total_val = Decimal('0')
    for line in pi.lines.all().order_by('line_number'):
        desc = (line.description or '').strip() or (line.material or '').strip()
        desc_html = _esc(desc).replace('\n', '<br/>')
        sz = _fmt_size_breakdown(line.size_breakdown, line.quantity_pcs)
        cell_desc = f'{desc_html}<br/><i>{_esc(sz)}</i>' if desc_html else f'<i>{_esc(sz)}</i>'
        price = line.unit_price_usd or Decimal('0')
        if line.line_value_usd is not None:
            val = line.line_value_usd
        elif line.unit_price_usd is not None:
            val = (Decimal(line.quantity_pcs) * Decimal(line.unit_price_usd)).quantize(Decimal('0.01'))
        else:
            val = Decimal('0')
        total_qty += line.quantity_pcs
        total_val += val
        table_data.append(
            [
                str(line.line_number),
                Paragraph(_esc(line.item_name), small),
                Paragraph(cell_desc, small),
                str(line.quantity_pcs),
                f'{price:.2f}' if line.unit_price_usd is not None else '—',
                f'{val:.2f}' if val else '—',
            ]
        )

    table_data.append(
        [
            '',
            '',
            Paragraph('<b>TOTAL</b>', small),
            str(total_qty),
            '',
            Paragraph(f'<b>{total_val:.2f}</b>', small),
        ]
    )

    tbl = Table(table_data, colWidths=[0.9 * cm, 3.1 * cm, 7.2 * cm, 1.5 * cm, 2 * cm, 2.2 * cm])
    tbl.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEAD),
                ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEAD_TEXT),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTSIZE', (0, 1), (-1, -2), 8),
                ('LINEABOVE', (0, 0), (-1, 0), 1, TEAL),
                ('LINEBELOW', (0, 0), (-1, 0), 0.5, RULE),
                ('GRID', (0, 0), (-1, -1), 0.25, TABLE_GRID),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecfdf5')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('LINEABOVE', (0, -1), (-1, -1), 0.75, TEAL),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 0.3 * cm))

    words = usd_amount_to_words(total_val if total_val > 0 else None)
    story.append(
        Table(
            [[Paragraph(f'<b>Amount in words (USD):</b> {_esc(words)}', body)]],
            colWidths=[17.2 * cm],
            style=TableStyle(
                [
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
                    ('BOX', (0, 0), (-1, -1), 0.5, RULE),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]
            ),
        )
    )
    story.append(Spacer(1, 0.35 * cm))

    our_b = (pi.our_bank_details or '').strip() or DEFAULT_OUR_BANK
    inter_b = (pi.intermediary_bank_details or '').strip() or DEFAULT_INTERMEDIARY
    story.append(Paragraph('<b>OUR BANK</b>', h2))
    story.append(Paragraph(_esc(our_b), body))
    story.append(Spacer(1, 0.12 * cm))
    story.append(Paragraph('<b>INTERMEDIARY BANK</b>', h2))
    story.append(Paragraph(_esc(inter_b), body))
    story.append(Spacer(1, 0.45 * cm))

    seller = (pi.seller_signatory_for or 'CID TRADING LTD').strip()
    buyer = (pi.buyer_signatory_for or 'J B INTERNATIONAL').strip()
    ret = (pi.return_email_instruction or 'shivangi.jain@jbinternational.co.in').strip()

    sig_tbl = Table(
        [
            [
                Paragraph(
                    f'<b>SIGNATURE &amp; SEAL</b><br/><br/>FOR: {_esc(seller)}',
                    body,
                ),
                Paragraph(
                    f'<b>SIGNATURE &amp; SEAL</b><br/><br/>FOR: {_esc(buyer)}',
                    body,
                ),
            ]
        ],
        colWidths=[8.6 * cm, 8.6 * cm],
    )
    sig_tbl.setStyle(
        TableStyle(
            [
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LINEABOVE', (0, 0), (-1, 0), 0.75, TEAL),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(sig_tbl)
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            f'PLS. SEAL &amp; SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: <b>{_esc(ret)}</b>',
            small,
        )
    )

    on_page = _make_page_canvas(company)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    data = buf.getvalue()
    buf.close()
    return data
