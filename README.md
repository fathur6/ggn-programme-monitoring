# GGN MQF 2.0 Programme Information Monitoring

Google Apps Script web application for managing MQF 2.0 programme information at the UniSZA Graduate School.

## Local Project

The deployable source is under `gas/`. It includes the recovered unsanitized local configuration and clasp metadata, which are intentionally ignored by Git. The matching Apps Script project ID is stored in `gas/.clasp.json`.

The application provides programme, PEO, PLO, graph, suggestions, file upload, authentication, and email announcement services. The design specification and implementation plan are under `specs/` and `plans/`.

## Development

Install clasp if needed:

```bash
npm install -g @google/clasp
```

From `gas/`:

```bash
clasp pull
clasp push
clasp version "description of changes"
clasp deploy -V <version> -i <deployment-id> -d "description"
```

Do not commit `gas/Config.gs` or `gas/.clasp.json`. They contain deployment-specific configuration and credentials.

## Reference

The public sanitized project documentation is maintained at:

https://github.com/fathur6/ggn-mqf2-monitoring
