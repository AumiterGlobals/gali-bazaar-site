# Gali Bazaar — design system

One system for the app (Compose: `ui/theme/Theme.kt`) and the website (`assets/site.css` variables).
Every rule has a **why**. If a screen needs something that is not here, add it here first.

## Colours

| Token | Value | Use | Why |
|---|---|---|---|
| `bg` | `#F7F3EE` | background of every screen | warm off-white: white cards stand out without shadows; feels like a street shop, not a bank |
| `card` | `#FFFFFF`, border 1px `#ECE4DC` | every card | a hairline border separates as well as a shadow and stays crisp on cheap phones |
| `soft` | `#F0E9E2` | segment control, placeholders, "Out of stock" tag, preview strip | neutral fill that never looks like an action |
| `ink` | `#1E1A1C` | text | near-black, softer than pure black on the warm bg |
| `muted` | `#6E6468` | small text, meta | still 4.5:1 on `bg` and white |
| `brand` | `#6A1BB0` | **only** the primary button, active bottom-nav item, selected state, links ("See all") | one action colour = people always know what to tap |
| `brand-soft` | `#F1E8FA` | selected background, active nav pill, "Call to order" tag | quiet partner of brand |
| `pink` | `#F0287A` | **only** offers / discounts ("10% off" tag: pink fill, white 11sp) | pink means "money saved" and nothing else, so it never competes with buttons |
| `pink-soft` | `#FDE6EF`, text `#8E1243` / `#B0144F` | offer strip, festival card | |
| `green` | `#12804A` / `#E3F3EA` | Open, Live, saved, Free, Cash at the door | good news |
| `amber` | `#B26A00` / `#FCF0DC`, border `#F2DDB8` | low stock, "waiting for you" | needs attention, not an error |
| red (errors only) | `#C62828` / `#FDECEC` | errors, "Paused · dues" | |

- **Logo is never recoloured:** "गली" `#6A1BB0` + "Bazaar" `#111111` + "." `#F0287A`. On a dark festival header the logo sits in a white pill (radius 10, padding 5×10). *Why:* a brand people recognise on every screen.
- **Gradient only in the festival header.** Everything else is flat. *Why:* the festival scene is special because nothing else is.
- **No shadows**, except the bottom sheet and the floating cart bar. *Why:* those two float above the page; nothing else does.

## Type

- Headings: **Funnel Display 500**, letter-spacing −1% to −2%. Text: **Funnel Sans 400 / 500**. Devanagari: Noto Sans Devanagari (system fallback on Android, Google Fonts on the web).
- Sizes (sp / px): screen title 24–26 · section heading 18 · card / shop / item title 14.5–15.5 (500) · body 14–15 · meta 12–13 · tag 11.5–12 (500) · button 16 (500) · KPI number 26.
- **No 700 / 800 anywhere.** Sentence case; ALL CAPS only for "ADD". *Why:* calm, readable, and the 500 weight is enough contrast for hierarchy.

## Spacing and shape

- Spacing scale 4 / 8 / 12 / 16 / 24 / 32. Screen side padding 18dp. 10–12dp between cards.
- Radius: card 16–18 · search / input 14 · button 14 (small 10) · chip 999 · tag 6 · category tile 16 · shop image tile 14 · item image 12 · bottom sheet top 24.
- Tap targets ≥ 48dp. Text contrast ≥ 4.5:1. *Why:* thumbs, sunlight, older eyes.

## Components (one style everywhere)

- **Primary button:** brand fill, 50dp, radius 14, white 16sp 500. One primary per screen.
- **Secondary button:** white, 1px line border, ink text, 36–44dp.
- **Circle icon button:** 40dp, white, 1px border (back, search, heart, bell). On a dark header: translucent white, white icon.
- **Search:** 48dp, white, 1px border, radius 14, search icon + muted placeholder.
- **Chip:** 34dp pill, white + border; selected = ink fill + white text.
- **Tags** (22dp, radius 6, 11.5sp 500): Open (green) · "Slot 5–7 pm" (soft) · "📞 Call to order" (brand-soft / brand) · "Out of stock" (soft / muted).
- **Offer tag** on an item image: top-left, pink fill, white "10% off".
- **ADD:** 32dp, radius 10, 1.5px brand outline, brand text. In the cart it becomes a brand-filled stepper "− 1 +".
- **Price:** 16sp 500 ink; MRP 12sp muted, struck through, beside it.
- **Icons:** line icons, stroke 1.8, rounded caps; one set across the app.
- **Art:** the website's `/img/art` 3D images — category tiles, shop tiles, and items without a photo.
- **Bottom nav:** 72dp, white, 1px top border, 4 items (icon + 11.5sp label). Active = brand, with a brand-soft 56×30 pill behind the icon.
- **Bottom sheet:** white, top radius 24, grab handle 40×4 `#D9D0C8`, scrim ink 35%.
- **Info card (with an action):** 36dp icon / art + title 14.5 500 + one line of meta + small secondary button on the right. Low stock = amber card; festival = pink card.

## Festival

- Header ~380dp scene (layered SVG / Compose Canvas, the same drawing on both). Each festival has its own scene.
- Light motion: parallax 4–10px, ≤ 60 particles, slower after 8 s, stops when hidden, static under reduce-motion / "Reduce animations".
- Icons and text on the dark header are white.

## Always

- No fake numbers, reviews or customer counts.
- Subscription price never appears in the app.
- Legal pages, the pay page, panels, PDFs and emails keep their plain document style.
