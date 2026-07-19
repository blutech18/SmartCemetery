# Smart Cemetery Navigation and Monitoring Platform — Manuscript Reference

> **Purpose of this file**: A clean, structured reference distilled from the original thesis manuscript (.docx), intended for AI/LLM context use, quick lookup, and downstream drafting (e.g., defense slides, abstracts, related-work checks). It preserves all substantive content, terminology, and structure while stripping formatting artifacts (highlighting, page breaks, image placeholders) from the source Word file.

---

## 0. Document Identity

| Field | Value |
|---|---|
| Title | "Smart Cemetery Navigation and Monitoring Platform: Digitalizing Burial Records with Multi-Platform Access" |
| Type | Undergraduate Thesis |
| Degree | Bachelor of Science in Information Technology |
| Institution | College of Information Technology, Liceo de Cagayan University, Cagayan de Oro City |
| Authors | Marc Gabriel I. Ratunil; Bob Bogart L. Pagurayan |
| Date | October 2025 |
| Research Site | Bolonsori Public Cemetery |
| SDG Alignment | SDG 9 — Industry, Innovation, and Infrastructure |

---

## 1. One-Paragraph Summary

A thesis proposing and building a web/mobile/kiosk platform that digitalizes paper-based cemetery burial records into a centralized, searchable MySQL database, and pairs it with a Google Maps–based visual map guide (highlighted grave marker, section/plot identifiers, route cues) so visitors can locate graves without staff help. Staff/Admin get role-based dashboards to update burial records, monitor plot status, approve requests, generate reports, and send notifications, all under encryption, authentication, and audit logging. Built with Next.js (React) on the frontend/API layer and MySQL on the backend, using the Design and Development Research (DDR) methodology with an Agile development cycle. Piloted at Bolonsori Public Cemetery.

---

## 2. Chapter 1 — The Problem and Its Scope

### 2.1 Introduction (key points)
- System digitalizes cemetery records into a centralized, searchable database (deceased's name, date of burial, plot number).
- Interactive mapping lets users search a grave and get real-time directions via a visual map guide (grave marker, section/plot identifiers, route cues) across web, mobile, kiosk.
- Staff can update burial info, monitor available plots, manage data via encrypted access.
- Problem context: most cemetery record-keeping is manual (paper logs, old maps, memory-based tracking), causing misplaced documents, inaccurate data, and difficulty locating graves — worst during peak seasons (All Saints'/All Souls' Days).
- Cited global precedents: Schmidt, Yuan & Jang (2019/2020, Minnesota — digitized burial logs + GPS + Google-Maps-style interface); Rahman et al. (2025, Bangladesh — web-based digital burial records); Hossain et al. (2025 — digital documentation improves transparency); Gonzaga et al. (2023, Negros Occidental, Philippines — interactive digital cemetery mapping).
- Local Philippine initiatives exist but are constrained in automation, integration, and public-facing interfaces.
- Directly supports **SDG 9** via digital transformation of cemetery infrastructure (databases, Google Maps mapping, multi-platform systems).

### 2.2 Conceptual Framework
- Uses the **Input–Process–Output (IPO) model** (Waseso et al., 2020).
- **Input**: existing cemetery records, user requirements, system resources, data security protocols.
- **Process**: data digitalization; mapping/GPS integration; system development (web, mobile, kiosk); smart monitoring; encryption & authentication implementation.
- **Output**: a fully functional smart cemetery platform — searchable digital database, real-time navigation, multi-platform accessibility, secure record management.
- "SMART" is defined operationally (not just a label): searchable burial records, map-guided grave identification, automated validation/duplicate-detection checks, plot-status monitoring, multi-platform access, traceable logs and analytics.

### 2.3 Statement of the Problem
Manual/paper-based systems → misplaced documents, inaccurate info, difficulty finding graves (esp. peak periods) → inconvenience for visitors, inefficiency for staff.

**Research questions:**
1. How can the system digitalize and organize existing cemetery records for easier data management?
2. How can the platform provide an accurate, searchable database allowing users to locate graves and view a visual map guide after selecting a result?
3. How can the system integrate smart monitoring to help staff update records and track available plots?
4. How can a multi-platform solution (web, mobile, kiosk) enhance accessibility via a responsive, dynamic visual map guide?
5. What data protection measures ensure confidentiality, integrity, and security of burial information?

### 2.4 Objectives of the Study
**Main objective**: Develop a Smart Cemetery Navigation and Monitoring Platform that modernizes cemetery management by converting manual burial records into a digital, secure, multi-platform system.

**Specific objectives:**
- Digitalize existing cemetery records into a centralized, organized database.
- Develop a searchable digital platform (search by name, date, other burial details).
- Integrate smart capabilities: real-time plot monitoring, automated record-validation alerts, activity logging, analytics.
- Implement a multi-platform system (web, mobile, kiosk) with responsive interactive map, highlighted grave marker, section/plot identifiers, step-by-step directions.
- Ensure data security/privacy via encryption, authentication, secure data-handling protocols.
- Apply a **records lifecycle policy**: remains records stay active for 5 years, then transition to a protected archive (no deletion), remaining searchable for authorized users.

### 2.5 Significance of the Study
- **Cemetery Visitors** — easier grave-finding via visual map guide; more time for reflection.
- **Cemetery Staff** — fewer direction requests → more time for grounds maintenance/operations.
- **Local Communities** — better visitor experience, community pride in preserving the site.
- **Researchers** — case study on tech in cemetery management/public spaces.
- **Future Researchers** — springboard for further studies on digital tools in memorial spaces.
- **Cemetery Authorities** — efficient, self-sustaining record management.

### 2.6 Output of the Study
- Fully functional platform: digital recordkeeping + GPS-based navigation + smart monitoring, centralized, secure, searchable via web/mobile/kiosk.
- Visitors search graves and view location via visual map guide (highlighted marker, section/plot identifiers, guided navigation cues) after selecting a result.
- Staff use an admin dashboard (encryption + secure login) to update burial info and monitor vacant plots.
- **Remains-records lifecycle**: 5-year active period → automatic reclassification to archive status (not deleted); archived records keep identifiers/map references, remain retrievable by authorized roles, protected by audit logging and backup-recovery controls.

### 2.7 Scope and Delimitation
- **Site**: Bolonsori Public Cemetery (initial implementation/testing site).
- **Users**: Visitors (search/navigation) and Cemetery Staff/Administrators (update/maintain records).
- **Access**: online, requires internet-capable devices (smartphones, computers, kiosks).
- **Remains-records policy**: minimum 5-year active retention → reclassified to archive (no deletion) at 5 years; archived records retain burial identifiers, grave-location references, history logs; searchable by authorized users; restorable to active workflows for legal/administrative/family-request purposes; role-based access + backup/recovery.
- **Excluded** (delimited out, possible future work): AI-based image recognition, drone mapping, blockchain integration.
- **Dependencies/limitations**: performance depends on internet connectivity and accuracy of encoded data.

### 2.8 Definition of Terms
| Term | Definition |
|---|---|
| Cemetery Mapping | Creating an organized digital/physical representation of a cemetery's layout and grave locations. |
| Interactive Map | Digital map accepting a query (e.g., name) and returning real-time directions via a visual map guide highlighting the grave marker and section/plot info. |
| Smart Cemetery | A modernized platform with searchable records, map-guided grave location, accessible multi-platform services, reliable/secure management, and traceable transactions — "SMART" denotes concrete capabilities, not a generic label. |
| Multi-Platform Access | System operability across web browsers, mobile phones, kiosks. |
| Burial Record | Documented info of a deceased person (name, burial date, plot number), stored/accessed digitally via centralized database. |
| Navigation Instructions | Step-by-step directions helping visitors find graves. |
| Self-Service System | Lets visitors independently access info/navigate without staff assistance. |
| Digitalization | Converting manual/paper data into digital form. |
| Feedback | User-provided info on system experience, used for improvement. |
| Grave Location | Specific site of a grave, identified by plot number and grave ID. |
| Cemetery Staff | Employees maintaining grounds, assisting visitors, managing burial/grave records. |

---

## 3. Chapter 2 — Review of Related Literature and Studies

Organized into 5 themes. (All citations as they appear in the manuscript; see Section 8 References for full list — note some in-text years differ slightly from the reference list, e.g., Schmidt et al. cited as 2019 in text but 2020 in references.)

### 3.1 Digital Cemetery Record Systems
- **Rahman, Karim & Hossain (2025)** — Bangladesh digital burial record-keeping system (web + mobile); stresses stakeholder engagement, staff training, infrastructure readiness.
- **Ahmed & Chowdhury (2024)** — qualitative study, Bangladesh; manual systems → inconsistent/incomplete records; digitizing improves accuracy/transparency; barriers: limited digital literacy, privacy concerns, lack of institutional support.
- **Demir & Yogeswaran (2018)** — semi-automated Google-Maps-based mapping; geotagging graves with photos/metadata/GPS on Google Maps.
- **Chia (2023)** — *Kubur Search* (Singapore, by Ramzul Ihsan) — digitized 66,000+ Muslim burial plots, Google Maps real-time directions.
- **Wilson & Clarke (2022)** — Chronicle Cemetery Management System; cloud-based + interactive mapping; role-based access control; search tools.
- **Brown & Jenkins (2021)** — Cemetery Records Scanning and Digitization Project, Marshfield, MA; scanned burial cards + digitized lot maps + geospatial linkage.

### 3.2 Geospatial Mapping and Navigation in Cemeteries
- **Hernandez, Cruz & Dela Peña (2025)** — online cemetery locator, Philippine municipal cemeteries; search by name/DOB/DOD.
- **Sultana et al. (2024)** — web-based burial search system (Malaysia); relational DB + keyword queries; real-time filtering.
- **Nguyen & Tran (2023)** — Vietnam; searchable DB + Google Maps interface; GPS coordinates on map.
- **Kaur & Sharma (2022)** — India; paper → searchable online burial registry; remote search access; mobile-friendly recommended.
- **Henderson & Miller (2021)** — UK prototype; keyword/filter-based cemetery information retrieval system.

### 3.3 Integrated Smart Monitoring Features
- **Lopez, Ramos & Villanueva (2025)** — automated record-tracking module; cloud interface; plot status indicators (available/reserved/occupied).
- **Rahman et al. (2024)** — IoT-based intelligent monitoring framework, Bangladesh; real-time DB for plots/maintenance; alerts for unoccupied plots.
- **Tan & Li (2023)** — Singapore; Google-Maps-based monitoring; staff update plot info on map; reduced record-updating time by 60%+.
- **Santos & Delgado (2022)** — Brazil municipal cemeteries; digital dashboard; mobile maintenance logging.
- **Hassan & Ibrahim (2021)** — Malaysia; cloud-based monitoring; tracks burial records, grave conditions, maintenance requests.

### 3.4 Multi-Platform Access and Usability
- **Fernandez et al. (2025)** — multi-platform (web, mobile, kiosk) cemetery navigation; integrated mapping with step-by-step directions.
- **Rahim et al. (2024)** — Malaysia smart cemetery locator; GPS + QR code; kiosks especially useful for elderly visitors.
- **Zhang & Liu (2023)** — China; comparative web/mobile geospatial navigation; responsive design + data sync across platforms.
- **Patel & Kumar (2022)** — unified mobile–kiosk interface; automated route generation.
- **Lopez & Hernandez (2021)** — Mexico City; touchscreen kiosks + companion mobile app; central DB, real-time updates.

### 3.5 Data Security and Privacy in Navigation Systems
- **Hassan et al. (2025)** — AES-256 encryption for burial data.
- **Nguyen & Le (2024)** — authentication + role-based access control (admin/staff/visitor); hashed passwords, session-based auth.
- **Rodriguez & Santos (2023)** — privacy-preserving anonymization for municipal public records.
- **Park & Choi (2022)** — SSL, two-factor authentication, encrypted communications for municipal data systems.
- **Anderson & Patel (2021)** — end-to-end encryption + digital authentication logs for local government data systems.

---

## 4. Chapter 3 — Materials and Methods

### 4.1 Research Design
- **Design and Development Research (DDR)** methodology — appropriate for creating/implementing/evaluating technological solutions to real-world problems.
- Iterative refinement of core modules: digital burial record management, visual map guidance, smart monitoring, secure multi-platform access.
- Integrates technical dimension (DB design, map-based navigation, security controls, activity logging) and operational dimension (accessibility, usability, service efficiency, workflow needs).
- Emphasizes evidence-based evaluation: functionality testing, usability checks, feedback analysis.
- Complemented by observational/analytical approach to study existing manual-record workflows (citing Creswell & Creswell, 2018, on observational research).

### 4.2 Development Model — Agile (Figure 2)
Iterative, adaptive; short cycles; continuous stakeholder feedback (citing Parada, Rojas-Puentes & Vera-Rivera, 2018). Phases:
1. **Requirement** — identify needs of admins, visitors, staff via surveys/interviews/consultations; define core functionalities (record management, grave search, GPS navigation, admin tools).
2. **Planning** — translate requirements into sprints (Scrum/Kanban); prioritize tasks; define milestones/deliverables/testing schedules.
3. **Design** — UI/wireframes for web/mobile/kiosk; database structure design; architecture planning for GPS integration + encrypted storage.
4. **Development** — backend/frontend coding; DB management; GPS API integration; continuous per-sprint testing.
5. **Release** — controlled deployment; beta test with selected staff/visitors; training sessions; feedback collection.
6. **Feedback and Improvement** — usability testing, surveys, stakeholder evaluation; iterative optimization (speed, map accuracy, security).

### 4.3 Research Setting
- **Bolonsori Public Cemetery** — undergoing redevelopment; culturally/historically significant; stakeholders = visitors, families, management staff.
- Map link referenced in source: https://maps.app.goo.gl/1h9jfbLcPuXGx8aW7

### 4.4 Research Instrument
Observational and analytical approach evaluating workflow, user interaction, and operational challenges of the existing manual system (citing Creswell & Creswell, 2018).

### 4.5 Data Gathering
- Structured interviews with cemetery administrators, staff, record keepers (citing Kothari, 2017, on structured interviews).
- On-site observations of visitor navigation and staff handling of inquiries.
- Informal conversations with visitors.
- All data analyzed to ground system design in real operational challenges.

### 4.6 System Design
- Defines system architecture, database schema, UI for web/mobile/kiosk (citing Anderson, 2022).
- Tools: flowcharts, ERDs, wireframes.
- Early prototyping/mockups to minimize design flaws (citing Nguyen et al., 2021).

### 4.7 Current System (Figure 4 — Current System Flow)
Bolonsori Public Cemetery currently uses a manual, paper-based system: visitors ask staff → staff check physical logbooks → directions given if records correct; records frequently missing/outdated → manual search/reliance on memory; visitors search unaided when records unavailable → delays and frustration; time-consuming, unreliable, staff-dependent; no centralized digital database or mapping.

### 4.8 Proposed System (Figure 5 — Proposed System Flow)
Centralized digital system connecting three user roles:
- **Admin** — oversees system operations, manages data security, validates updates.
- **Staff** — updates/verifies burial records.
- **Client (Visitor)** — searches for graves, accesses GPS-based navigation via a responsive visual map guide (highlighted markers, plot identifiers) on web/mobile/kiosk.

Real-time synchronization across all activities ensures accurate data flow and communication between users.

### 4.9 System Architecture (Figure 7 — three-tier architecture)
| Tier | Description |
|---|---|
| **Presentation (Client) Tier** | Next.js UI built with React components/pages; role-aware interfaces for Admin/Staff/Client across web, mobile, kiosk. Search/navigation algorithms run client-side in-browser. Google Maps API integration provides interactive map (highlighted grave markers, section/plot identifiers, route overlays). |
| **Application (Logic/Server) Tier** | Next.js API routes and server actions handle business logic: authentication (secure session management), data validation, business rules. Node.js server logic with an ORM/query layer connects to the DB. Orchestrates workflows for burial-record management, plot monitoring, user administration. GPS mapping services and geolocation utilities run server-side (grave search, geocoding, real-time navigation processing). |
| **Data Tier** | MySQL RDBMS stores all persistent cemetery records (grave details, plot info, location data, user accounts). Data integrity via indexing and relationship constraints. Core tables: `users`, `graves`, `plots`, `locations`, `user_logs`. |

Flow: client HTTP/API calls → server logic → SQL queries to MySQL DB (standard Next.js + MySQL pattern; separation of concerns; scalable/maintainable).

### 4.10 Entity Relationship Diagram (Figure 6 — E-RD)
Core entities: **Grave, Grave Details, Plot, Location** (mirrors physical cemetery layout) plus **Location Details**. Each Grave assigned to a Plot; Grave Details holds supplementary burial info. Location/Location Details define zones/subsections for navigational accuracy.

**User entity** differentiated by `UserType` (admin, staff, visitor) → role-based access control.
**UserLog entity** logs all interactions (searches, updates, navigation activity) for accountability/traceability.
**Use entity** captures how visitors/staff/admins engage with the system (multi-platform, user-centered design).

Sub-diagrams (Figures 7–16 in source numbering, note: figure numbers restart/overlap in the manuscript around the architecture section):
- User – Burial Record
- User – UserLog
- User – Request
- User – Feedback
- Plot – BurialRecord
- BurialRecord – Grave
- Plot – Grave
- Plot – Location
- Navigation – BurialRecord
- Location – LocationDetails

### 4.11 Database Structure
- Database name: **CemeteryMap**
- **11 tables**, each with 2+ attributes.

**Data Dictionary (table list — column-level detail is in image-based tables in the source .docx and was not machine-readable as text):**
1. Table 1 — User
2. Table 2 — Burial Record
3. Table 3 — User Log
4. Table 4 — Request
5. Table 5 — Feedback
6. Table 6 — Plot
7. Table 7 — Grave
8. Table 8 — Location Details
9. Table 9 — Navigation
10. Table 10 — Location
11. (11th table implied by "11 tables" total — not separately captioned in extracted text; likely Grave Details or similar, per ERD entities)

> **Note**: The actual column names/data types for these 11 tables are embedded as screenshot images in the original .docx (not extractable as text via this conversion). If precise field-level schema is needed, request OCR/manual transcription of those specific table images.

### 4.12 Use Case Diagrams (Figures 15–16 in source)
- Figure 15 — Use Case Diagram for Admin
- Figure 16 — Use Case Diagram for User

Framing note in source text: refers to the system once as "AI-Powered Cemetery Mapping and Geoconferencing for Enhanced Navigation" when introducing use-case descriptions — likely a leftover/alternate working title, inconsistent with the thesis's primary title. Flag this for correction if producing a clean final version.

### 4.13 Use Case Descriptions (Tables 9–18 as numbered in source)

**Admin use cases:**

| Use Case | Description | Normal Flow (summary) |
|---|---|---|
| Manage Cemetery Layout | Admin manages/updates the digital cemetery layout for accuracy and usability. | Log in → go to "Manage Layout" → select section → modify (add plots, update status/occupant info, reallocate sections) → save → verify via preview. |
| Update Grave Records | Admin updates/corrects grave/burial record data. | (Standard record-edit flow; log in → locate record → edit → save → verify.) |
| Generate Reports | Admin generates system/operational reports. | Log in → select report parameters → generate → review/distribute. |
| Approve User Request | Admin reviews and approves/rejects user-submitted requests (e.g., plot reservation, record updates). | Log in → "User Requests" section → view/evaluate pending requests → verify validity → approve/reject → notify user of decision. |
| Send Notification | Admin sends notifications to users about updates, approvals, announcements. | Log in → "Notifications" section → select audience → compose message → preview → send → confirm delivery. |

**User (Visitor) use cases:**

| Use Case | Description | Normal Flow (summary) |
|---|---|---|
| Search Grave | User searches for a grave and views its location via a visual map guide, without staff help. | Access via kiosk/mobile app → "Search Grave" → enter criteria (name, grave ID, burial year) → review results → select record → view details. |
| Submit Request | User submits a request (e.g., plot reservation, record update). | Log in → "Submit Request" → complete form (plot number, personal info) → review → submit → receive confirmation with reference ID. |
| View Map and Direction | User views the interactive map and gets directions to a selected grave. | (Select search result → map displays highlighted marker/section/plot identifiers → follow route cues.) |
| Provide Feedback | User submits feedback about their system experience. | (Access feedback section → enter feedback → submit.) |
| Track Request Status | User checks the status of a previously submitted request using a reference ID. | (Enter/select reference ID → view current status.) |

**Common structural fields per use case table** (as used consistently throughout the source): Actor · Use Case Name · Description · Normal Flow · Alternate Flow · Pre-Condition · Post-Condition · Assumption.

**Representative Alternate Flows / Pre-Post-Conditions / Assumptions (fully captured examples):**
- *Manage Cemetery Layout*: Alt flow — system errors → detailed error message/troubleshooting or contact support; incomplete input → admin notified to complete missing info. Pre-condition — valid admin credentials with appropriate access rights; system operational and connected to DB. Post-condition — layout updated and accurately displayed; changes logged for audit.
- *Approve User Request*: Alt flow — incomplete request → marked incomplete, user notified for details; invalid/conflicting request → rejected with reason. Pre-condition — users have submitted requests; admin has review/management access rights. Post-condition — approved requests processed/updated; users informed of status. Assumption — admin follows cemetery policies/system guidelines; users provide complete/accurate details.
- *Send Notification*: Alt flow — send failure → error message with retry/escalate options; incomplete recipient list → system prompts review/update. Pre-condition — notification functionality enabled; admin has relevant info to share. Post-condition — users receive/acknowledge notification; activity logged. Assumption — notifications relevant/timely; users regularly check for updates.
- *Search Grave*: Alt flow — no matches → prompt to refine criteria or seek staff help; DB unavailable → inform user, suggest retry later. Pre-condition — user has sufficient search details; search functionality operational. Post-condition — grave location displayed; search query logged for analysis. Assumption — user enters criteria correctly; DB is up-to-date/accurate.
- *Submit Request*: Alt flow — incomplete form → prompt for missing details; submission failure (connectivity) → retry options, draft saved.
- *Track Request Status*: Assumption — users retain their request reference ID for tracking; system updates request statuses promptly.

### 4.14 Sequence Diagrams (Figures 17–22 in source)
17. Admin Login
18. Admin New/Update Plot
19. Admin View Request
20. User Login
21. User Search Plot
22. User Request Reservation

> Cited rationale (Minhas et al., 2015): sequence diagrams visually capture object interactions over time, support requirements validation, design documentation, and testing.

### 4.15 Activity Diagrams (Figures 23–28 in source)
23. Admin Login
24. Admin New/Update Plot
25. Admin View Request
26. User Login
27. User Search Plot
28. User Request Reservation

---

## 5. Graphical User Interface (Screens Documented)
The manuscript includes screenshots (not text-extractable) for the following screens:
1. Sign Up
2. Sign In
3. User Dashboard
4. User Map Page
5. Admin Dashboard
6. Admin Map Page

---

## 6. Key Actors / Roles Summary

| Role | Core Capabilities |
|---|---|
| **Admin** | Manage cemetery layout, update grave records, generate reports, approve/reject user requests, send notifications, oversee data security, validate updates. |
| **Staff** | Update and verify burial records, monitor plots, respond to on-the-ground record needs. |
| **Client / Visitor (User)** | Search graves, view visual map guide with real-time directions, submit requests (e.g., plot reservation, record update), track request status, provide feedback. |

---

## 7. Technology Stack (as specified)

| Layer | Technology |
|---|---|
| Frontend / Presentation | Next.js (React components and pages) |
| Mapping | Google Maps API |
| Backend / Application logic | Next.js API routes, server actions; Node.js server logic; ORM/query layer |
| Database | MySQL (relational) — database named **CemeteryMap**, 11 tables |
| Security | Encryption, authentication, secure session management, role-based access control, audit/activity logging |
| Platforms | Web, Mobile, Kiosk |

---

## 8. Full Reference List (as given in the manuscript)

Ahmed, S., & Chowdhury, R. (2024). Digitizing burial information in Bangladesh: Challenges and opportunities.

Anderson, J. (2022). Principles of effective system design for public information systems.

Anderson, P., & Patel, R. (2021). Secure data management systems for local government digital records.

Brown, T., & Jenkins, L. (2021). Cemetery records scanning and digitization project in Marshfield, Massachusetts.

Chia, M. (2023). Kubur Search: A digital mapping initiative for Muslim burial grounds in Singapore.

Creswell, J. W., & Creswell, J. D. (2018). Research design: Qualitative, quantitative, and mixed methods approaches (5th ed.). SAGE.

Demir, A., & Yogeswaran, K. (2018). Semi-automated Google Maps–based cemetery mapping using GPS and metadata tagging.

Fernandez, R., et al. (2025). Multi-platform cemetery navigation system using web, mobile, and kiosk integration.

Gonzaga, M. P., Salvideo, A. B., Octava, A. M., Baquiano, G. E., & Velez, J. A. (2023). GIS-based burial record and grave mapping system for public cemeteries in Negros Occidental, Philippines. *Philippine Information Technology Journal, 16*(1), 57–72.

Hassan, A., & Ibrahim, R. (2021). Cloud-based monitoring for cemetery management systems in Malaysia.

Hassan, K., et al. (2025). AES-256 encryption for burial data protection in cemetery information systems.

Hernandez, P., Cruz, L., & Dela Peña, J. (2025). Online cemetery locator system for municipal cemeteries in the Philippines.

Kaur, P., & Sharma, R. (2022). Online burial registry systems and accessibility improvements in India.

Kothari, C. R. (2017). Research methodology: Methods and techniques. New Age International.

Lopez, G., & Hernandez, P. (2021). Interactive kiosk system integrated with mobile navigation for cemetery applications.

Lopez, J., Ramos, D., & Villanueva, R. (2025). Automated plot-tracking and real-time digital monitoring system for cemeteries.

Morales, R. S., Villanueva, P. J., & Ignacio, L. C. (2021). University-led QR code initiatives for cemetery management in Northern Luzon: A pilot study. *Journal of Philippine Community Informatics, 8*(1), 15–31.

Nguyen, H., & Le, D. (2024). Role-based authentication and access control in cemetery management web systems.

Nguyen, P., et al. (2021). Prototyping and visualization methods for early-stage system design.

Nguyen, T., & Tran, L. (2023). Google Maps–based digital burial information platform in Vietnam.

Park, S., & Choi, J. (2022). SSL and multi-factor authentication for secure municipal data systems.

Parada, A., Rojas-Puentes, G., & Vera-Rivera, J. (2018). Agile methodologies and productivity in software development teams.

Patel, A., & Kumar, S. (2022). Unified mobile–kiosk system for digital cemetery navigation.

Rahim, M., et al. (2024). Smart locator with GPS and QR code integration in Malaysian cemeteries.

Rahman, A., et al. (2024). IoT-enabled monitoring framework for public cemetery management.

Rahman, M., Karim, R., & Hossain, T. (2025). Digital burial record-keeping and management system in Bangladesh.

Rodriguez, A., & Santos, M. (2023). Privacy-preserving data anonymization for public digital records.

Santos, M., & Delgado, F. (2022). Digital dashboard system for cemetery maintenance and record management.

Schmidt, M. L., Yuan, F., & Jang, W. (2020). Cemetery mapping and digital data analysis: A case study in Minnesota, USA. *Journal of Geography and Geology, 12*(2), 40–54.

Sultana, R., et al. (2024). Web-based burial search system with real-time query filtering.

Sultana, S., Rahman, M., Ahmed, K., & Chowdhury, R. (2023). Cemetery allocation management using Ethereum blockchain. In *Blockchain and Trustworthy Systems* (pp. 123–134). Springer.

Tan, H., & Li, S. (2023). Google Maps–assisted cemetery monitoring system implementation in Singapore.

Waseso, M., et al. (2020). Application of the Input–Process–Output (IPO) model in system development.

Wilson, T., & Clarke, J. (2022). Chronicle Cemetery Management System: A cloud-based model for digital cemetery mapping.

Zhang, Y., & Liu, W. (2023). Comparative analysis of geospatial cemetery navigation systems across web and mobile platforms in China.

> Additional citations appearing in-text but **not** found in the reference list above (possible omissions in the original manuscript): Sommerville (2015), Dennis et al. (2015), Minhas et al. (2015), Henderson & Miller (2021), Gonzaga et al. (2023) [year cited as 2023 in-text, consistent], Morales et al. (2021) [present]. Worth flagging to the authors for a references audit.

---

## 9. Notes, Inconsistencies, and Gaps Found During Extraction

These are worth resolving before a final defense/submission version:

1. **Title casing typo**: Cover page repeats the title with a typo — "MULTI-PLATFORM ACCESSS" (extra "S") on the inner title page, vs. "ACCESS" on the outer cover.
2. **Alternate working title**: Section 4.12 (use case descriptions intro) refers to the system as "AI-Powered Cemetery Mapping and Geoconferencing for Enhanced Navigation" — inconsistent with the official thesis title; likely leftover text from an earlier draft/different concept.
3. **Citation year mismatch**: Schmidt, Yuan & Jang cited as **(2019)** in Chapter 1 narrative but listed as **(2020)** in the References section.
4. **Missing/uncited references**: Sommerville (2015), Dennis et al. (2015), and Minhas et al. (2015) are cited in-text (use case/sequence diagram rationale) but do not appear in the References list. Henderson & Miller (2021) is cited in Chapter 2 but also missing from the reference list.
5. **Figure numbering restarts**: Figure numbers appear to restart or overlap around the System Architecture / ERD section (e.g., "Figure 7" is used both for System Architecture and for a User–Burial Record ERD sub-diagram). A renumbering pass is recommended.
6. **Data Dictionary tables (11 tables) are images**, not machine-readable text in the source .docx — only 10 are individually captioned/extractable by name in the text flow (User, Burial Record, User Log, Request, Feedback, Plot, Grave, Location Details, Navigation, Location); the 11th table referenced by "11 tables" total is not separately named in the extracted text (likely "Grave Details," per the ERD narrative, but unconfirmed).
7. **Minor grammatical slip** in Table 12 (Approve User Request) post-condition: "Approvedatd requests" (typo, likely "Approved").
8. **Images not converted**: all figures (conceptual framework diagram, flowcharts, ERD, sequence/activity diagrams, GUI screenshots, data dictionary tables) exist only as embedded images in the source file and are referenced here by caption/number only — they are not reproduced as text/data in this reference file.

---

## 10. Suggested Use of This Reference File
- Use as grounding context when answering questions about the thesis without needing to re-parse the original .docx.
- Use Section 4.13 as a lookup table when drafting or discussing use-case-driven documentation (SRS, test cases, user stories).
- Use Section 9 as a punch-list if asked to help clean up/revise the manuscript before final defense or binding.
- For anything requiring exact column-level schema (Section 4.11) or diagram visuals, the original .docx's embedded images still need to be consulted directly (OCR or manual transcription).
