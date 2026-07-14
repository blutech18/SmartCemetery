# SYSTEM SPECIFICATION: SMART CEMETERY NAVIGATION AND MONITORING PLATFORM

## 1. PROJECT METADATA
* **System Name:** Smart Cemetery Navigation and Monitoring Platform: Digitalizing Burial Records with Multi-Platform Access
* **Target Implementation Site:** Bolonsori Public Cemetery
* **Primary Platform Targets:** Web Browser, Mobile Devices, Interactive On-site Kiosks
* **Core Technology Stack:** * Frontend: Next.js (React)
  * Backend: Node.js (Next.js API routes)
  * Database: MySQL (Relational)
  * Mapping Engine: Leaflet with managed or self-hosted map tiles and a cemetery-specific pedestrian routing service

### 1.1 Mapping Architecture Decision
Leaflet is the approved interactive-map renderer. Production deployments MUST configure a managed or self-hosted tile source and MUST NOT depend on the public OpenStreetMap tile infrastructure as an operational service. Grave-level directions use a managed or self-hosted pedestrian routing endpoint built from cemetery-specific walkable paths. Public OSRM is permitted only as a development fallback. Google Maps may be offered as an external link for travel to the cemetery entrance, but is not the grave-level mapping engine.

## 2. PROBLEM STATEMENT & OBJECTIVES
### 2.1 The Problem
Cemeteries currently rely on manual, paper-based record systems. This leads to misplaced documents, inaccurate data, and severe difficulties in locating specific graves (especially during peak visitation periods like All Saints' Day). Staff are overwhelmed by manual inquiries, and visitors face navigational frustration.

### 2.2 Core Objectives
1. **Digitalize Records:** Convert manual burial records into a centralized, searchable digital database.
2. **Interactive Navigation:** Provide multi-platform access (web, mobile, kiosk) to visual map guides with highlighted grave markers and step-by-step routing.
3. **Smart Monitoring:** Implement real-time plot monitoring, automated validation alerts, and system usage analytics.
4. **Data Security:** Ensure privacy through AES-256 encryption, role-based access control, and strict data-handling protocols.

## 3. SYSTEM ARCHITECTURE
The system employs a standard 3-tier architecture:
* **Presentation Tier (Client Layer):** Next.js UI with Leaflet components. It renders managed/self-hosted tiles, cemetery sections, plot markers, and route overlays. Public kiosks use the same map with privacy-safe reset behavior.
* **Application Tier (Server/Logic Layer):** Node.js server logic. It handles business rules, secure sessions, duplicate and completeness validation, GPS processing, and access to the configured cemetery-specific pedestrian routing service.
* **Data Tier (Database Layer):** MySQL relational database. It stores cemetery records and the authoritative plot/path data required for grave-level navigation, with indexes and relationship constraints enforcing integrity.

## 4. DATABASE ENTITIES (ERD CONTEXT)
The `CemeteryMap` database consists of 11 primary tables. Core entities include:
* **User Entity:** Governed by `UserType` (Admin, Staff, Client).
* **Location Entities:** `Location` and `Location Details` define specific zones/subsections.
* **Plot & Grave Entities:** `Plot`, `Grave`, and `Grave Details`. Each grave is assigned to a specific plot.
* **Interaction Entities:** `UserLog` (audit trails), `Request` (user submissions), `Feedback`, and `Navigation` (routing logs).

## 5. USER ROLES AND USE CASES
### 5.1 Administrator
* **Manage Cemetery Layout:** Add plots, update layout statuses.
* **Update Grave Records:** Add, modify, or delete burial data.
* **Generate Reports:** Export burial statistics, logs, and summaries (PDF/Excel).
* **Approve User Requests:** Review and validate user-submitted requests (e.g., plot reservations).
* **Send Notifications:** Broadcast system updates.

### 5.2 Staff
* **Verify Records:** Cross-reference physical logs with digital inputs.
* **Monitor Plots:** Track status of available vs. occupied plots.
* **Assist Visitors:** Aid non-digital visitors using the staff interface.

### 5.3 Client (Visitor)
* **Search Grave:** Query by deceased name, grave ID, or year.
* **View Map and Direction:** Access visual map guide and step-by-step routing.
* **Submit Request:** Apply for plot reservations or record updates.
* **Track Request Status:** Monitor approval state via a unique reference ID.
* **Provide Feedback:** Submit system usability feedback.

## 6. BUSINESS LOGIC & SMART RULES
When processing data within this system, the following strict rules apply:
1. **Record Lifecycle Rule (5-Year Archival):** Remains records stay in the active workflow for exactly 5 years. After 5 years, they are automatically reclassified to "Archive" status. **Archived records are NEVER deleted.** They retain map references and remain searchable to authorized users.
2. **Duplicate Detection:** The system automatically checks new inputs against existing entries to prevent double-booking of plots.
3. **Incomplete-Record Alerts:** Staff are alerted if encoded records lack critical identifiers (e.g., missing GPS nodes or burial dates).
4. **Smart Search:** If an exact name match is not found, the system must suggest the closest phonetic matches or nearby section records.

## 7. SYSTEM DELIMITATIONS (OUT OF SCOPE)
Do NOT include or assume the existence of the following features in the current system version:
* AI-based image recognition (e.g., headstone scanning).
* Drone mapping integrations.
* Blockchain or decentralized ledgers.
* Integrated financial payment gateways (for reservations).
