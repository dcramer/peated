# Events

Use this workflow to add, fix, or retire whisky events in production. The
events API, schema, and web pages own exact behavior.

Events are public whisky festivals, shows, and tastings that people can attend,
such as Whisky Show London or Fèis Ìle. They appear on the public events page,
the home page, and each event's calendar file. They are not the Entity history
records (`entity_event`) that track openings, closures, and ownership changes.

## Purpose

Peated keeps a public, accurate calendar of established whisky events so people
can find what is coming up near them. Coverage is the goal: any established
whisky event with published dates belongs here. Do not limit the list to a
region or to the largest shows.

Nobody scrapes events. Admins add and maintain them by hand, so accuracy
depends on checking the organiser's site before every write.

## What Belongs

- Public events with a fixed date that people can attend: festivals, shows,
  fairs, and organiser-run tasting days.
- Each edition is its own row. Add next year's edition when the organiser
  publishes its dates.
- Country-wide observances such as World Whisky Day use `repeats`.

Do not add:

- Events without published dates. "Every February" is not a date. Record the
  organiser's site in the recheck list below instead.
- Bar nights, brand launches, and private or trade-only events.
- Dates taken from aggregator calendars, ticket resellers, or trade-show
  directories. Use them to find candidates, then confirm on the organiser's
  site.

## Fields

- `name`: the organiser's name for the event, without the year. City-series
  events use `Name (City)`, such as `Whisky Global (Kelowna)`.
- `dateStart` and `dateEnd`: the public days. Leave `dateEnd` empty for a
  one-day event.
- `website`: the organiser's page for this edition when it has one, otherwise
  the organiser's home page. Store the URL the site resolves to, not one that
  redirects.
- `country`: the country ID. Scotland is its own country; London, England, and
  Wales events use United Kingdom. The public region filter groups events by
  country, so an event without a country is missing from every region.
- `address`: the venue and city as the organiser prints them. Leave it empty
  when the venue is not announced.
- `description`: optional and rarely needed. Do not paste marketing copy.

Events are unique on `dateStart` plus a case-insensitive `name`.

## Find Candidates

- Start with organisers already in the catalog: read `/events` with
  `onlyUpcoming=false` and look for series with a past edition but no upcoming
  one.
- Use calendar sites such as drammer.com, whiskypassion.nl, and
  insidethecask.com to find events not yet in the catalog.
- Check the organiser's site for sister events. The Whisky Exchange, for
  example, runs Whisky Show London and Welcome to Whisky from one site.

## Apply And Verify

- Confirm dates, venue, and city on the organiser's site immediately before
  writing. Note the page you used.
- Read `/events` first and search by name so you do not create a second row for
  an edition that exists under a slightly different name.
- Create through `pnpm cli api post /events` or `pnpm cli api batch`. Edit
  through `pnpm cli api patch /events/<id>`. The admin events pages do the same
  work in a browser.
- Read each event after writing. Confirm the name, dates, country, address, and
  website.
- Report the changed event IDs, the sources used, and every event you could not
  confirm.

## Recheck

Keep this list current. It holds established events whose next dates were not
published at the last check, so the next sweep starts here.

Checked 2026-09-18, no 2027 dates published:

- Whisky Fringe, Edinburgh — royalmilewhiskies.com
- Chichibu Whisky Matsuri — chichibuwhiskymatsuri.jp
- Spirit of Toronto — spiritoftoronto.ca
- Tokyo International BarShow / Whisky Live Tokyo — tokyobarshow.com
- Whisky Festival in Osaka and Whisky & Spirits Festival in Yokohama —
  whiskyfestival.jp
- Nth Show Las Vegas — universalwhiskyexperience.com
- The Only Whisky Show, Johannesburg and Cape Town — whiskybrother.com
- Whisky Show Old & Rare — whiskyshow.com (no 2027 edition announced)
- Swiss Whisky Festival — whisky-festival.ch (site unavailable)
- Whiskey Live Dublin — whiskeylivedublin.com (site blocked automated reads)
