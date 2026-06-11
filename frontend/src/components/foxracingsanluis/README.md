# San Luis Component Notes

The official San Luis event is `san-luis-car`.

San Luis is a car track and should use the shared car handling model. Its differences should come from authored track data, not from a separate car physics fork.

San Luis is intentionally different from the Australia and Belgium car tracks in these ways:

- The layout is custom and hand-authored in `TrackData.ts`, not imported from GeoJSON.
- The track is narrower than the standard car tracks.
- The start/finish pose is explicit instead of derived from a curve `t` value or longest straight.
- Lap validation currently requires both the shared minimum-distance rule and the stricter reached-end rule.
- The track has no separate wall/advertising-board collision system authored today.
- Future elevation should be authored around the narrow road corridor instead of applying random terrain under the road.

The current refactor should preserve these differences while moving repeated behavior into shared systems:

- Keep vehicle behavior on `shared-car`.
- Keep the `san-luis` road/profile metadata as the source of width and proximity thresholds.
- Keep explicit start direction until track definitions can author all start poses the same way.
- Keep the stricter lap-validation flag unless sector/checkpoint validation replaces it with a stronger shared model.
- Treat San Luis multiplayer/socket fallbacks as migration behavior until player identity and auth are fully centralized.

Do not make San Luis look like the standard imported tracks just to reduce conditionals. Normalize the system boundaries, not the track identity.
