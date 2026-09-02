# Bottle Classifier Glossary

This glossary applies
[ASD-STE100 Simplified Technical English, Issue 9](https://www.asd-ste100.org/about_STE.html)
to Bottle classification. It defines the necessary Peated technical terms. Use
each term with the meaning in this table. Use no other term for the same
concept.

| Term                         | Definition                                                                     | Code form                 |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| **Bottle**                   | One complete product release.                                                  | `Bottle`                  |
| **Bottle Group**             | An internal storage group for fields that multiple Bottles share.              | `BottleGroup`             |
| **Bottle Alias**             | A verified other name shown on a Bottle page and used in customer search.      | `BottleAlias`             |
| **Bottle Reference**         | A source name that can be assigned to one Bottle, left unresolved, or ignored. | `BottleReference`         |
| **Bottle Reference Input**   | Source text, an image, or a URL submitted for Bottle identification.           | `BottleReferenceInput`    |
| **Reference Classification** | The process that identifies a Bottle from a Bottle Reference Input.            | `classifyBottleReference` |
| **Match**                    | The Bottle Reference Input identifies an existing Bottle.                      | `match`                   |
| **Create Bottle**            | The Bottle Reference Input identifies a Bottle that is not in the catalog.     | `create_bottle`           |
| **No Match**                 | The system cannot identify a Bottle safely.                                    | `no_match`                |
| **Suggested Change**         | An untrusted catalog change from an agent.                                     | `ProposedOperation`       |
| **Review Operation**         | A change that the server validated and checked for permission before it runs.  | `ReviewOperation`         |

Use the term in the first column in prompts and technical documentation. Use
the code form only when you refer to a code or storage symbol. Customer text
must use the plain wording in `skills/peated-writing/SKILL.md`. Do not add an
adjective to **Bottle** to distinguish it from **Bottle Group** storage.

Use short, active sentences for classifier text. Give one instruction in each
sentence. Add a technical term to this glossary before you use it with a new
Peated-specific meaning.
