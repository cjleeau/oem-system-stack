# OEM System Stack Intelligence – D3 Intelligence Model

- Version: v7.0 (Phase 11)
- Created: 2026-03-05

## Overview
This project models the global automotive OEM digital ecosystem using a layered systems architecture and D3 visualisation.

This model blends regulatory evidence, public disclosures, and structured architectural inference.

Relationships are tagged by verification level to distinguish confirmed partnerships from modelled system dependencies.

## Core Capabilities
- Grid (default), Network, and Architecture view (layered lanes)
- CSV-driven architecture
- Telemetry filter
- Evidence-only (VERIFIED) filter
- Provenance + citation discipline

## Layer Definitions
19 locked architectural layers spanning Ownership through Energy & Charging.

## Confidence Levels
- soft – modelled
- medium – industry-aligned
- hard – regulatory / formally mandated

## Evidence Status
- ASSUMED
- REFERENCED
- VERIFIED

## Evidence logic
Edge is treated as verified if:
- `evidence_status == VERIFIED` OR
- `verified_edge == true` OR
- `source_url` is present

In Evidence Only mode:
- Only verified edges remain
- Only nodes connected to verified edges remain

## Verification Priority
- P1 – Regulatory backbone
- P2 – Tier 1 integrations
- P3 – Ecosystem / assumed flows

## Developer
- Chris Lee – https://www.linkedin.com/in/christopherjustinlee/
- Mr Lee Co – https://www.mrleeco.com/

## Changelog
- v1.0 – Europe Grid
- v2.0 – Multi-tier expansion
- v3.0 – Evidence fields
- v4.0 – Cross-border modelling
- v5.0 – Provenance + documentation + branding
- v6.0 - UX hardening and governance ergonomics

## Analytics
- Google Analytics (gtag) is loaded in index.html.
- app.js emits a lightweight `view_change` event and a `page_view` on tab switches when `gtag` is available.
