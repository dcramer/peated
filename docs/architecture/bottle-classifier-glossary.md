# Bottle Classifier Glossary

This glossary applies
[ASD-STE100 Simplified Technical English, Issue 9](https://www.asd-ste100.org/about_STE.html)
to Bottle classification. It defines the necessary Peated technical terms. Use
each term with the meaning in this table. Use no other term for the same
concept.

| Term                         | Definition                                                                    | Code form                 |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| **Bottle**                   | One complete product release.                                                 | `Bottle`                  |
| **Bottle Group**             | An internal storage group for fields that multiple Bottles share.             | `BottleGroup`             |
| **Bottle Reference**         | Source text, an image, or a URL that can identify one Bottle.                 | `BottleReference`         |
| **Reference Classification** | The process that identifies a Bottle from a Bottle Reference.                 | `classifyBottleReference` |
| **Match**                    | The Bottle Reference identifies an existing Bottle.                           | `match`                   |
| **Create Bottle**            | The Bottle Reference identifies a Bottle that is not in the catalog.          | `create_bottle`           |
| **No Match**                 | The system cannot identify a Bottle safely.                                   | `no_match`                |
| **Suggested Change**         | An untrusted catalog change from an agent.                                    | `SuggestedChange`         |
| **Review Operation**         | A change that the server validated and checked for permission before it runs. | `ReviewOperation`         |

Use the term in the first column in prompts, documentation, and user text. Use
the code form only when you refer to a code or storage symbol. Do not add an
adjective to **Bottle** to distinguish it from **Bottle Group** storage.

Use short, active sentences for classifier text. Give one instruction in each
sentence. Add a technical term to this glossary before you use it with a new
Peated-specific meaning.
