# Changelog

All notable changes to quero are documented here.

## [0.2.0] - 2026-02-17

### Added
- **Binding-based queue routing**: Route messages based on queue binding name instead of queue URL
- Support for `batch.queue` property for automatic queue identification

### Changed
- Queue names in `.queue()` now match the binding name, not the full queue URL

## [0.1.0] - 2026-02-17

### Added
- Initial release
- `QueueRouter` class for type-safe queue routing
- Valibot schema validation
- Multiple queue support
- Full TypeScript support with type inference
- Automatic message acknowledgment

---

See the full [CHANGELOG.md](https://github.com/psteinroe/quero/blob/main/CHANGELOG.md) on GitHub.
