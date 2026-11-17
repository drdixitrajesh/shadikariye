# Kundali matching method — 15 November 2026

Scope: a free, optional, client-only North Indian Ashtakoota calculator. Birth inputs are React state, never query parameters, form submissions, profile data, localStorage or analytics payloads. Nothing is saved or sent to an astrology provider. Inputs and submit remain disabled until client hydration. Reset clears entered data and results. The tool does not decide marriage suitability and does not calculate a full natal chart, ascendant, Mangal dosha, dashas, navamsa or dosha cancellations.

## Moon and time

Astronomy Engine 2.1.19 (Donald Cross, MIT, installed as a pinned dependency) supplies the geocentric true-ecliptic Moon position. JavaScript Intl with explicit IANA zone interprets the birth-place local time independently of the device zone. Nonexistent DST times are rejected; ambiguous times require explicit earlier/later selection. A matching city label does not geocode coordinates. This is intentional: geocentric lunar longitude depends on the instant, not terrestrial latitude/longitude. The UI explains why a correct birth-place time zone is necessary.

Lahiri approximation: reference ayanamsa 22.46047 degrees at JD 2415020.0, advanced using IAU 2006 general precession in longitude. Add the engine's nutation in longitude to align with its true-ecliptic lunar longitude before subtraction. This is a documented approximation to the published Lahiri reference, not a claim of using Swiss Ephemeris. Dates are limited to 1900–2099 and must not be future births. A conservative 0.05-degree exclusion zone around rashi/nakshatra/pada boundaries suppresses definitive totals. Correct birth times and an independent panchang check remain important.

References:

- [Astronomy Engine official API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)
- [Published Lahiri reference epoch](https://saravali.github.io/astrology/aya_basics.html)
- [USNO Circular 179, precession/nutation](https://aa.usno.navy.mil/downloads/Circular_179.pdf)
- [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), used only with synthetic public test dates for independent geocentric lunar checks. It is not called by the product.

## Scoring convention

Use the factual tables documented by the author of [Guna Milan Method](https://thetelugucalendar.com/marriage-matching/method/), identifying Muhurta Chintamani, Vivaha Prakarana and its specified commentary. Bride is the row; groom is the column. Traditional schools and some calculators differ, especially Vashya, Yoni and Gana. This selected convention is stated in the product rather than claiming a universal score.

1. Varna (1): lunar-rashi classification; no user's caste is collected or inferred. Groom's ordered class must be at least bride's.
2. Vashya (2): the commentary's four-group mapping and 4×4 matrix, not the alternate five-group/half-sign convention.
3. Tara (3): inclusive cyclic counts in both directions between nakshatras, modulo nine; remainders 3, 5, 7 each lose 1.5 points. Absolute nakshatra numbers are not substituted for the pairwise count.
4. Yoni (4): full 14×14 table in the cited convention, including the documented horse/buffalo correction. Directional entries are preserved.
5. Graha Maitri (5): natural relationships of the two lunar-rashi lords, using the published 7×7 matrix.
6. Gana (6): the cited 3×3 matrix, bride rows, groom columns; it is intentionally directional.
7. Bhakoot (7): zero for inclusive lunar-sign distances 2/12, 5/9, 6/8, otherwise seven.
8. Nadi (8): zero for equal nadi groups, otherwise eight.

The sum is the base score out of 36. Nadi/Bhakoot zeroes are displayed separately; no health, fertility, longevity or relationship-success predictions are made. Exceptions or cancellations do not silently increase the score. Result displays the input zone, lunar rashi, nakshatra, pada and all eight rows. Editing inputs immediately removes stale results.

## Validation

Unit tests cover calendar validity, time-zone equivalence, half-hour/quarter-hour offsets, DST gaps and folds, lunar positions against independent JPL Horizons observations, published reference ayanamsa, zodiac wrap/boundaries, fixed scoring examples, directional Gana, Yoni enemy pairs, and valid half-point/bounded totals across 108 lunar-pada positions. Browser QA uses fictional details and verifies the visible result and zero birth-data POST requests. Existing profile/privacy tests run separately.
