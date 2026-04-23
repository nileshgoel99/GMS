"""Integer / USD amount to words (uppercase) for PI documents."""

from decimal import Decimal

_SMALL = (
    'ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE THIRTEEN FOURTEEN FIFTEEN '
    'SIXTEEN SEVENTEEN EIGHTEEN NINETEEN'
).split()
_TENS = 'TWENTY THIRTY FORTY FIFTY SIXTY SEVENTY EIGHTY NINETY'.split()
_SCALES = ('', 'THOUSAND', 'MILLION', 'BILLION')


def _below_thousand(n: int) -> str:
    if n < 20:
        return _SMALL[n]
    if n < 100:
        t = _TENS[n // 10 - 2]
        if n % 10:
            return f'{t} {_SMALL[n % 10]}'
        return t
    h = n // 100
    rest = n % 100
    head = f'{_SMALL[h]} HUNDRED'
    if rest == 0:
        return head
    return f'{head} {_below_thousand(rest)}'


def int_to_words_upper(n: int) -> str:
    if n == 0:
        return 'ZERO'
    if n < 0:
        return 'MINUS ' + int_to_words_upper(-n)
    parts = []
    idx = 0
    while n > 0:
        chunk = n % 1000
        if chunk:
            scale = _SCALES[idx]
            w = _below_thousand(chunk)
            parts.append(f'{w} {scale}'.strip() if scale else w)
        n //= 1000
        idx += 1
    return ' '.join(reversed(parts))


def usd_amount_to_words(amount: Decimal | None) -> str:
    if amount is None or amount == 0:
        return 'USD ZERO AND ZERO/100 ONLY'
    q = amount.quantize(Decimal('0.01'))
    dollars = int(q)
    cents = int((q * 100) % 100)
    d = int_to_words_upper(dollars)
    c = int_to_words_upper(cents)
    return f'USD {d} AND {c}/100 ONLY'
