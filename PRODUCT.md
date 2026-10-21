# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static single-file HTML/CSS/JS. No build step, no CDN, no external fonts or images at runtime. The same `index.html` is the source for the web marketplace, the GitHub Pages public link, and the Floot wrapper used to produce the Android and iOS builds.

## Users

- **Compradores:** families, restaurants, shops and distributors in Formosa who want to buy food and artisan goods directly from local producers. They use a phone, often on a variable or weak connection.
- **Productores:** small and medium farmers, family agriculture, beekeepers, cheesemakers, fishers and agro-industrial artisans from Formosa who need a credible shopfront, direct orders and help telling their story.
- **Técnicos y estudiantes:** AgTech students, agronomists, designers and communicators who support the producers and use the training material.

## Product Purpose

InnovaAgro-App connects Formosa producers directly with consumers, shops and distributors. It combines a seasonal catalog, producer storytelling, direct WhatsApp contact, delivery routes, local order records and short training capsules for sales oratory, storytelling and social media. Success means a producer can publish a product and receive a real order, and a buyer can understand where the food comes from before buying it.

## Positioning

The product is not only a catalog: every product is attached to a named producer, a place, a seasonal window and a story. The same app trains the producer to tell that story and turns it into a direct sale, without intermediaries and without requiring a stable connection.

## Operating Context

- Mobile-first use in Formosa (capital, El Colorado, Clorinda, Las Lomitas, Pirané, Laguna Blanca and nearby places).
- Variable connectivity. The catalog, cart, orders and training progress must work offline and persist on the device.
- WhatsApp is the main commercial channel. Orders must be shareable as a pre-written WhatsApp message.
- Producers may not have a computer; the producer panel must work on a phone in the field.
- Deliveries happen on weekly routes with cut-off times and pickup points.
- The project brief is a public innovation program, not a private startup. The interface should feel like civic infrastructure with craft, not like a luxury boutique.

## Capabilities and Constraints

- Single-file app: all CSS, JS, logo, photographs and fonts embedded. No server, no API keys, no network dependency.
- Buyer flows: browse, search, filter, product detail, producer profile, favorites, cart, pickup/delivery, checkout, order receipt, order history, reorder, WhatsApp, route map and training.
- Producer flows: dashboard, product create/edit/stock/pause, order status, public profile editor, WhatsApp settings, training and pitch builder.
- Local persistence via `localStorage`. Export/import a JSON backup. A failed storage write must not break the session.
- Payments are illustrative: Mercado Pago/transfer/cash options create a pending order and hand off to WhatsApp. No card data is collected and no payment is claimed as processed.
- Demo data (producers, products, prices, routes, orders) is clearly labeled as illustrative and must not be presented as real commercial evidence.
- The logo supplied by the user is the only binding visual asset. Fonts and photographs must be openly licensed and credited in-app.
- Platform target: installable web app and Floot wrapper for Android/iOS. Must respect mobile safe areas, 16 px form inputs, hash navigation and the system back gesture.

## Brand Commitments

- Name: **InnovaAgro-App**.
- Descriptor: **Tecnología & Naturaleza · Formosa**.
- Supplied medallion logo: bronze rim, compass, palms, sunrise, cotton, citrus, tractor, drone, smartphone and circuit-network lines. It sets the material world: deep forest green, sun gold, oxidized copper, field paper.
- Voice: warm, concrete, proud of origin, never paternalistic. Spanish rioplatense, no corporate jargon.
- Must keep the "technology and nature" tension visible; neither a rustic souvenir shop nor a generic SaaS dashboard.

## Evidence on Hand

- `C:\Users\guill\Downloads\Documento (3).pdf` — program brief, technical architecture, functional modules, training plan.
- `C:\Users\guill\Downloads\43 instructivo-publicar-apps-github-floot.pdf` — publishing workflow for GitHub Pages and Floot, including the single-file HTML constraint and the Android/iOS wrapper path.
- `C:\Users\guill\Downloads\WhatsApp Image 2026-10-20 at 6.27.05 PM.jpeg` — supplied InnovaAgro-App medallion logo.
- No real producer data, prices, orders, testimonials, payment credentials or analytics exist. All such content is synthetic demo material and must stay labeled.

## Product Principles

1. **Origin is the product.** Every screen should make the producer, the place and the season tangible.
2. **Weak signal is the default.** Never block a task on the network; never lose a cart or an order.
3. **The next action is obvious.** A buyer should reach a product and a WhatsApp message in a few taps; a producer should publish stock in under a minute.
4. **Training is part of commerce.** Oratory, storytelling and social media are first-class features, not a marketing appendix.
5. **Honesty over polish.** Demo data, simulated payments and illustrative photographs are labeled plainly.

## Accessibility & Inclusion

- Works on low-end Android phones and small screens (320 px upward).
- Body text at least 16 px on inputs, 4.5:1 contrast, 44 px touch targets, visible keyboard focus, reduced-motion support.
- Spanish only for this version; copy avoids technical anglicisms where a plain Spanish word exists.
- Offline and low-literacy support through icons, short labels, photos and voice narration where available.
