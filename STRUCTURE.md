# STRUCTURE.md

> **Uwaga dla agentów AI**: Ten plik musi być aktualizowany po każdej zmianie w strukturze projektu.
> Przed rozpoczęciem nowego taska przeczytaj ten plik, a po zakończeniu — zaktualizuj go.

## Ogólny opis projektu

**Skyguin Meblox** — webowa aplikacja do projektowania mebli 3D.

| Warstwa | Technologie |
|---------|-------------|
| Frontend | Vue 3, TypeScript, Three.js (rendering 3D), Tailwind CSS v4, Pinia (state management) |
| Backend | Bun (runtime), SQLite (baza danych) |
| Build | Vite, TypeScript, Biome (linter/formatter) |
| Testy | Bun test (unit/integracyjne), Playwright (regresja e2e) |
| Hooki | Husky (pre-commit, pre-push) |

---

## Struktura katalogów

```
skyguin-meblox/
├── .git/                        # Repozytorium Git
├── .gitignore                   # Ignorowane pliki
├── .husky/                      # Hooki Git (pre-commit, pre-push)
│   ├── pre-commit               # Uruchamia: lint, typecheck, test, regression przed commitem
│   └── pre-push                 # Uruchamia: build + verify-start przed pushem
├── .idea/                       # Konfiguracja IDE (JetBrains)
├── AGENTS.md                    # Instrukcje dla agentów AI
├── STRUCTURE.md                 # Ten plik — mapa struktury projektu
├── README.md                    # Dokumentacja projektu
├── biome.json                   # Konfiguracja Biome (linter/formatter)
├── bun.lock                     # Lockfile zależności Bun
├── package.json                 # Definicja projektu, skrypty, zależności
├── tsconfig.json                # Konfiguracja TypeScript (strict, ES2022)
├── database.sqlite              # Baza danych SQLite (runtime)
│
├── client/                      # Frontend (Vue 3 + Vite)
│   ├── index.html               # Punkt wejścia HTML
│   ├── public/                  # Pliki statyczne
│   ├── vite.config.ts           # Konfiguracja Vite (Vue plugin, Tailwind)
│   └── src/                     # Źródła klienta
│       ├── main.ts              # Punkt wejścia Vue — createApp, Pinia, mount
│       ├── App.vue              # Główny komponent — layout, skróty klawiszowe, routing widoków
│       ├── style.css            # Style globalne (Tailwind)
│       ├── env.d.ts             # Deklaracje typów środowiskowych
│       ├── components/          # Komponenty Vue (szczegóły poniżej)
│       ├── composables/         # Composables Vue (szczegóły poniżej)
│       ├── lib/                 # Biblioteki pomocnicze (szczegóły poniżej)
│       └── types/               # Typy i schematy Zod
│
├── server/                      # Backend (Bun + SQLite)
│   ├── index.ts                 # Punkt wejścia serwera — uruchomienie na porcie 3001
│   ├── app.ts                   # Fabryka handlera fetch — routing, rejestracja kontrolerów, serwowanie statycznych plików
│   ├── types.ts                 # Typy TypeScript dla wierszy bazy danych i payloadów
│   ├── db/                      # Warstwa bazy danych
│   │   └── database.ts          # Inicjalizacja SQLite, tworzenie tabel, singleton bazy
│   ├── utils/                   # Narzędzia serwerowe
│   └── controllers/             # Kontrolery REST API
│
├── tests/                       # Testy integracyjne
│   ├── server.app.test.ts       # Testy API serwera (CRUD projektów, obiektów, materiałów, relacji, komponentów, historii)
│   └── client.helpers.test.ts   # Testy helperów klienta (grid, presety, relacje, snap anchory, typy)
│
├── scripts/                     # Skrypty automatyzacji
│   ├── run-regression.ts        # Runner testów regresyjnych Playwright (e2e)
│   ├── verify-start.ts          # Weryfikacja buildu produkcyjnego i uruchomienia serwera
│   ├── smoke-project-open.ts    # Smoke test otwierania projektu
│   └── debug-playwright.mjs     # Helper do debugowania Playwright
│
└── specs/                       # Specyfikacje i mockupy
    ├── 001-kontrola-widoku.md   # Specyfikacja UI/UX (po polsku) — ikony, historia, kontekst, magnes
    ├── img.png                  # Mockup UI
    └── img_1.png                # Mockup UI
```

---

## Klient — Komponenty (`client/src/components/`)

### `SceneCanvas/`
| Plik | Opis |
|------|------|
| `SceneCanvas.vue` | Główny komponent sceny 3D (Three.js). Renderowanie obiektów meblowych, obsługa interakcji myszy (drag, klik, menu kontekstowe), snap anchory, wizualizacja relacji na Canvas 2D overlay. Obsługuje magnetowanie (snap krawędzi), duplikowanie, usuwanie, dodawanie obiektów. |
| `sceneCanvasInteractions.ts` | Funkcje pomocnicze dla gestów wskaźnika — `beginPointerGesture()`, `wasPointerDrag()`, `shouldDeselectFromCanvasClick()`. Śledzi gesty drag vs. klik. |
| `__tests__/SceneCanvas.test.ts` | Testy jednostkowe komponentu SceneCanvas. |

### `ProjectsDashboard/`
| Plik | Opis |
|------|------|
| `ProjectsDashboard.vue` | Dashboard pełnoekranowy z siatką kart projektów (z miniaturami). Operacje: tworzenie, otwieranie, zmiana nazwy, duplikowanie, usuwanie projektów z dialogiem potwierdzenia. Pokazuje pusty stan gdy brak projektów. |
| `__tests__/ProjectsDashboard.test.ts` | Testy jednostkowe komponentu ProjectsDashboard. |

### `ContextBar/`
| Plik | Opis |
|------|------|
| `ContextBar.vue` | Dolny pływający pasek kontekstowy zmieniający się zależnie od stanu zaznaczenia. Tryby: "none" (przycisk dodaj), "object-actions" (przesuń, materiały, magnes, kopiuj, usuń), "move-controls" (strzałki + rotacja), "snap-mode" (feedback magnetyczny). Obsługuje skróty klawiszowe (strzałki, R = rotacja, X/Y/Z = osie). |
| `__tests__/ContextBar.test.ts` | Testy jednostkowe komponentu ContextBar. |

### `ObjectPropertiesPanel/`
| Plik | Opis |
|------|------|
| `ObjectPropertiesPanel.vue` | Panel prawy edycji właściwości zaznaczonego obiektu: nazwa, wymiary (szer/wys/głęb), pozycja (X/Y/Z), rotacja, paleta kolorów z wybierakiem, wybór szablonu materiału, info o przynależności do komponentu (sync/independent). |
| `__tests__/ObjectPropertiesPanel.test.ts` | Testy jednostkowe. |

### `ComponentsPanel/`
| Plik | Opis |
|------|------|
| `ComponentsPanel.vue` | Panel prawy z listą grup komponentów i ich obiektów. Tworzenie komponentu z 2+ zaznaczonych obiektów, usuwanie grup, przełączanie trybu sync/independent. Baner informacyjny o funkcjonalności. |
| `__tests__/ComponentsPanel.test.ts` | Testy jednostkowe. |

### `ToolButton/`
| Plik | Opis |
|------|------|
| `ToolButton.vue` | Reużywalny przycisk z ikoną dla toolbara — active/inactive styling. Props: `title`, `active`. |
| `toolButtonUtils.ts` | Eksportuje `getToolButtonClass()` — klasy CSS na podstawie stanu aktywności (niebieskie podświetlenie vs. szare). |
| `__tests__/ToolButton.test.ts` | Testy logiki stylowania. |

### `SideTile/`
| Plik | Opis |
|------|------|
| `SideTile.vue` | Mały interaktywny kafelek materiału — reprezentuje jedną stronę panelu (góra/dół/lewo/prawo/przód/tył). Wyświetla kolorowe kropki warstw, przycisk dodawania warstwy. Emituje zdarzenia click/add. |
| `__tests__/SideTile.test.ts` | Testy jednostkowe. |

### `ProjectsModal/`
| Plik | Opis |
|------|------|
| `ProjectsModal.vue` | Modal z listą wszystkich projektów (zaznaczanie, tworzenie, usuwanie, przełączanie). Wyświetla pusty stan gdy brak projektów. Emituje `select-project` i `close`. |
| `projectsModalUtils.ts` | Funkcja `formatDate()` (formatowanie PL), stała `DEFAULT_PROJECT_NAME`. |
| `__tests__/ProjectsModal.test.ts` | Testy jednostkowe. |

### `ObjectsPanel/`
| Plik | Opis |
|------|------|
| `ObjectsPanel.vue` | Panel prawy z listą obiektów w projekcie — kolor, wymiary, odznaki komponentów (⬡ sync / ★ independent). Akcje hover: właściwości, duplikacja, usuwanie. Przycisk dodawania → AddObjectDialog. |
| `__tests__/ObjectsPanel.test.ts` | Testy jednostkowe. |

### `AddObjectDialog/`
| Plik | Opis |
|------|------|
| `AddObjectDialog.vue` | Modal formularza tworzenia nowego obiektu meblowego. Pola: nazwa, wymiary (W/H/D), paleta kolorów + hex, wybór szablonu materiału. Przyciski szybkich presetów (bok 720×600×18, półka 600×30×580 itp.). Walidacja formularza. |
| `__tests__/AddObjectDialog.test.ts` | Testy jednostkowe. |

### `MaterialsPanel/`
| Plik | Opis |
|------|------|
| `MaterialsPanel.vue` | Panel prawy z listą szablonów materiałów + wskaźnikami kolorów bazowych. Tworzenie nowych szablonów (prompt), usuwanie. Kliknięcie → MaterialTemplateEditor do szczegółowej edycji. |
| `__tests__/MaterialsPanel.test.ts` | Testy jednostkowe. |

### `RelationsPanel/`
| Plik | Opis |
|------|------|
| `RelationsPanel.vue` | Panel prawy tworzenia/zarządzania relacjami między obiektami. Dwa typy relacji: dimension (linkowanie wymiarów) i attachment (zakotwiczanie obiektów do punktów). Edytory trybów wizualnych i attachment. Duży komponent ~1400 linii. |
| `__tests__/RelationsPanel.test.ts` | Testy jednostkowe. |

### `MaterialTemplateEditor/`
| Plik | Opis |
|------|------|
| `MaterialTemplateEditor.vue` | Edytor pojedynczego szablonu materiału. Siatka 3×3 UI do wyboru strony (góra/lewo/centrum/prawo/dół/przód/tył). Edycja warstw per strona: kolor, grubość, toggle dwustronny. Formularz dodawania nowej warstwy (typ, kolor, grubość). |
| `__tests__/MaterialTemplateEditor.test.ts` | Testy jednostkowe. |

### `GridSettingsPanel/`
| Plik | Opis |
|------|------|
| `GridSettingsPanel.vue` | Panel prawy ustawień wizualizacji siatki. Kontrolki: widoczność, selektor jednostek (mm/cm), slidery rozmiaru komórek per oś (X/Y/Z), szybkie presety (10mm, 50mm, 100mm, 200mm, 500mm, 1cm), wyświetlanie aktualnych wartości. |
| `__tests__/GridSettingsPanel.test.ts` | Testy jednostkowe. |

### `HistoryPanel/`
| Plik | Opis |
|------|------|
| `HistoryPanel.vue` | Panel prawy z osią czasu wszystkich zmian. Każdy wpis: etykieta akcji i timestamp. Wizualizacja timeline z kropkami. Zaznaczenie wpisu → przyszłe wpisy szare, przycisk "Cofnij do tego momentu" z potwierdzeniem. |
| `__tests__/HistoryPanel.test.ts` | Testy jednostkowe. |

---

## Klient — Composables (`client/src/composables/`)

### `useAppStore/`
| Plik | Opis |
|------|------|
| `useAppStore.ts` | Pinia store zarządzający całym stanem aplikacji: projekty, obiekty, materiały, komponenty, relacje, historia, panele UI, tryb sceny, ustawienia siatki, stan snap anchorów. Eksportuje 100+ mutacji stanu i akcji (CRUD obiektów, przełączanie projektów, tworzenie komponentów, nawigacja historii, skróty klawiszowe). |
| `index.ts` | Re-eksport `useAppStore`. |
| `__tests__/useAppStore.test.ts` | Testy jednostkowe akcji i mutacji store'a. |

### `useApi/`
| Plik | Opis |
|------|------|
| `useApi.ts` | Klient REST API. Eksportuje obiekt `api` z metodami: projects (list/create/update/delete/duplicate), objects (CRUD, batch update, duplicate z offsetem), components (CRUD), relations (CRUD), materials (CRUD z warstwami), history (list/revert/navigate). Bazowy URL: `/api`. |
| `index.ts` | Re-eksport `api`. |
| `__tests__/useApi.test.ts` | Testy integracyjne API. |

### `useScene/`
| Plik | Opis |
|------|------|
| `useScene.ts` | Fabryka tworząca scenę Three.js z renderowaniem obiektów meblowych. Zarządza kamerą, oświetleniem, rendererem, raycastingiem do selekcji obiektów. Obsługuje: synchronizację obiektów ze store'em, budowanie wizualizacji siatki, drag z snappingiem, podświetlanie ścian/krawędzi, markery snap anchorów, przechwytywanie screenshotów. 400+ linii. |
| `index.ts` | Re-eksport `useScene`. |
| `__tests__/useScene.test.ts` | Testy jednostkowe zarządzania sceną. |

---

## Klient — Biblioteki (`client/src/lib/`)

### `relationsBuilder/`
| Plik | Opis |
|------|------|
| `relationsBuilder.ts` | Logika wizualnego edytora relacji. Narzędzia: `canConnectFields()` (walidacja połączeń), `createBuilderLayout()` (pozycjonowanie węzłów), `createBuilderEdgePath()` (ścieżki SVG), `getRelationFieldKind()` (dimension vs. position), `estimateRelationLabelWidth()` (overlay rendering). |
| `index.ts` | Re-eksport funkcji relationsBuilder. |
| `__tests__/relationsBuilder.test.ts` | Testy logiki buildera relacji. |

### `grid/`
| Plik | Opis |
|------|------|
| `grid.ts` | Narzędzia konfiguracji siatki: `displayGridValue()` (konwersja mm ↔ cm), `normalizeGridInput()` (konwersja inputu użytkownika na mm), `GRID_PRESETS` (predefiniowane rozmiary). Typy: `GridUnit`, `GridAxisKey`, `GridPreset`. |
| `index.ts` | Re-eksport narzędzi grid. |
| `__tests__/grid.test.ts` | Testy konwersji siatki. |

### `objectPresets/`
| Plik | Opis |
|------|------|
| `objectPresets.ts` | Presety obiektów meblowych do szybkiego tworzenia: `OBJECT_PRESETS` (bok 720×600×18, półka 600×30×580, dno 600×18×580, front 200×720×18, blat 800×38×600), `OBJECT_COLOR_PALETTE` (brąz, beż, niebieski, szary, biały itp.). |
| `index.ts` | Re-eksport presetów. |
| `__tests__/objectPresets.test.ts` | Testy presetów obiektów. |

### `snapAnchors/`
| Plik | Opis |
|------|------|
| `snapAnchors.ts` | System snap anchor pointów do magnetycznego przyciągania krawędzi. 18 anchorów per obiekt (6 środków ścian [czerwone] + 12 środków krawędzi [niebieskie]). Funkcje: `getObjectSnapAnchors()`, `anchorWorldPos()`, `anchorMarkerWorldPos()`, `computeSnapPosition()`, `getAnchorLabel()`. |
| `index.ts` | Re-eksport narzędzi snap anchorów. |
| `__tests__/snapAnchors.test.ts` | Testy logiki snap anchorów. |

### `projectThumbnails.ts`
| Plik | Opis |
|------|------|
| `projectThumbnails.ts` | Logika przechwytywania miniatur projektów. `saveProjectThumbnailIfNeeded()` — przechwytuje canvas sceny i uploaduje miniaturę JPEG przy przełączaniu projektów. Helpery do rozdzielczości screenshotów i integracji z API. |

---

## Klient — Typy (`client/src/types/`)

| Plik | Opis |
|------|------|
| `index.ts` | Schematy Zod i typy TypeScript dla wszystkich modeli domenowych: `Project`, `FurnitureObject`, `MaterialLayer`, `MaterialTemplate`, `ComponentGroup`, `ObjectRelation`, `HistoryEntry`, `AppPanel`, `SceneMode`, `ContextMode`, `GridConfig`, `RelationEditorMode`. Eksportuje etykiety: `RELATION_TYPE_LABELS`, `RELATION_FIELD_LABELS`, `RELATION_MODE_LABELS`, `SIDE_LABELS`, `LAYER_TYPE_LABELS`, `OPPOSITE_SIDES`. ~350 linii. |
| `__tests__/types.test.ts` | Testy schematów typów. |

---

## Serwer — Kontrolery (`server/controllers/`)

### `projects/`
| Plik | Opis |
|------|------|
| `projects.ts` | Handlery CRUD projektów. Endpointy: `GET /projects`, `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id`, `POST /projects/:id/duplicate`. Zarządza metadanymi (nazwa, opis, rozmiar siatki, miniatura). |
| `__tests__/projects.test.ts` | Testy handlerów projektów. |

### `objects/`
| Plik | Opis |
|------|------|
| `objects.ts` | Handlery CRUD obiektów meblowych. Endpointy: GET/POST/PUT(batch)/DELETE, duplikacja z opcjonalnym offsetem. Tworzy/aktualizuje rekordy. Wywołuje `syncRelations()` po modyfikacjach do propagacji zmian wymiarów/pozycji. ~200 linii. |
| `__tests__/objects.test.ts` | Testy handlerów obiektów. |

### `materials/`
| Plik | Opis |
|------|------|
| `materials.ts` | Handlery szablonów materiałów i warstw. Endpointy dla szablonów (GET/POST/PUT/DELETE) i warstw (GET/POST/PUT/DELETE per szablon/warstwa). Zarządza wielowarstwowymi definicjami materiałów z obsługą warstw dwustronnych. ~200 linii. |
| `__tests__/materials.test.ts` | Testy handlerów materiałów. |

### `relations/`
| Plik | Opis |
|------|------|
| `relations.ts` | Handlery relacji między obiektami (dimension/attachment). Endpointy: GET/POST/PUT/DELETE. Waliduje definicje relacji i synchronizuje zależne obiekty po zmianach. ~150 linii. |
| `__tests__/relations.test.ts` | Testy handlerów relacji. |

### `components/`
| Plik | Opis |
|------|------|
| `components.ts` | Handlery grup komponentów (grupy synchronizacji). Endpointy: GET groups, POST create, PUT sync member, DELETE group. Zarządza grupowaniem obiektów z synchronizowanymi wymiarami i trybami niezależnej edycji. ~200 linii. |
| `__tests__/components.test.ts` | Testy handlerów komponentów. |

### `history/`
| Plik | Opis |
|------|------|
| `history.ts` | Handlery historii i undo/redo. Endpointy: GET lista, POST revert (obcina przyszłą historię), POST navigate (zachowuje przyszłość). Max 100 wpisów per projekt. Przechowuje JSON snapshoty stanu `furniture_objects`. ~250 linii. |
| `__tests__/history.test.ts` | Testy handlerów historii. |

---

## Serwer — Narzędzia (`server/utils/`)

| Plik | Opis |
|------|------|
| `db.ts` | Helpery zapytań bazodanowych: `getOne<T>()`, `getAll<T>()`, `createRouter()` (dopasowanie wzorców routingu z regex i ekstrakcją parametrów). |
| `http.ts` | Narzędzia HTTP: `json()` (odpowiedź JSON ze statusem), `cors()` (nagłówki CORS), `parseObjectBody<T>()`, `parseArrayBody<T>()`, `toSqlValue()`, type guardy. |
| `relations.ts` | Obliczanie i synchronizacja relacji: `getAxisDimension()`, `getProjectRelations()`, `buildRelation()`, `syncRelations()` (propagacja zmian wymiarów/pozycji przez łańcuch relacji, max depth 200). ~350 linii. |

---

## Serwer — Baza danych (`server/db/`)

| Plik | Opis |
|------|------|
| `database.ts` | Setup SQLite: `configureDatabase()` (WAL + klucze obce), `initializeDatabase()` (tworzenie tabel), `createDatabase()` (fabryka), `getDatabase()` (singleton). Tabele: `projects`, `furniture_objects`, `component_groups`, `object_relations`, `material_templates`, `material_layers`, `history_entries` z ograniczeniami kluczy obcych. ~250 linii. |

---

## Serwer — Pliki główne

| Plik | Opis |
|------|------|
| `index.ts` | Punkt wejścia serwera. Inicjalizuje bazę danych, uruchamia fetch handler na porcie (domyślnie 3001), loguje komunikat startu. Tryb debug via `LOG_LEVEL`. |
| `app.ts` | Fabryka handlera fetch. Importuje i rejestruje wszystkie kontrolery. Serwuje pliki statyczne z `client/dist`. Routing z dopasowaniem wzorców URL i CORS. |
| `types.ts` | Definicje typów TS dla modeli wierszy bazy danych: `ProjectRow`, `ComponentGroupRow`, `MaterialTemplateRow`, `MaterialLayerRow`, `FurnitureObjectRow`, `ObjectRelationRow`, `HistoryRow` i typy payloadów. |

---

## Testy (`tests/`)

| Plik | Opis |
|------|------|
| `server.app.test.ts` | Testy integracyjne API serwera — CRUD projektów, obiektów, materiałów, relacji, komponentów, historii. Tworzy tymczasową bazę SQLite per test. |
| `client.helpers.test.ts` | Testy helperów klienta — konwersja siatki (mm ↔ cm), presety obiektów, logika relacji, snap anchory, schematy typów. |

---

## Skrypty (`scripts/`)

| Plik | Opis |
|------|------|
| `run-regression.ts` | Runner testów regresyjnych Playwright — uruchamia serwer deweloperski i UI, testy e2e: tworzenie projektu, dodawanie obiektów, interakcje sceny, edycja materiałów. |
| `verify-start.ts` | Weryfikacja buildu produkcyjnego — buduje klienta, uruchamia serwer, sprawdza endpointy healthcheck (API + UI). |
| `smoke-project-open.ts` | Smoke test otwierania/edycji projektu przez UI. |
| `debug-playwright.mjs` | Helper do debugowania Playwright. |

---

## Specyfikacje (`specs/`)

| Plik | Opis |
|------|------|
| `001-kontrola-widoku.md` | Dokument wymagań UI/UX (PL) — usprawnienia ikon, zarządzanie projektami z menu hamburger, historia zmian z panelem timeline, kontekstowy dolny pasek, kontrola ruchu/rotacji, skróty klawiszowe, magnetyczne przyciąganie krawędzi ("magnes"). |
| `img.png`, `img_1.png` | Mockupy UI referencyjne. |

---

## Komendy (`package.json` scripts)

| Komenda | Opis |
|---------|------|
| `bun run dev` | Uruchomienie serwera deweloperskiego (backend) |
| `bun run dev:ui` | Uruchomienie Vite dev server (frontend) |
| `bun run build` | Typecheck + build Vite (produkcja) |
| `bun run start` | Uruchomienie serwera produkcyjnego |
| `bun run start-debug` | Uruchomienie z LOG_LEVEL=debug |
| `bun run typecheck` | Sprawdzenie typów TS + Vue |
| `bun run lint` | Sprawdzenie lintingu (Biome) |
| `bun run lint:fix` | Automatyczne poprawki lintingu |
| `bun test` / `bun run test:run` | Uruchomienie testów jednostkowych (--bail przy test:run) |
| `bun run test:regression` | Testy regresyjne Playwright (e2e) |
| `bun run verify:start` | Weryfikacja buildu + start serwera |

---

## Konwencje i wzorce

- **Komponenty Vue**: Każdy w osobnym katalogu z plikiem `.vue` + opcjonalnym `.ts` (utils) + `__tests__/`.
- **Composables**: Wzorzec setup store (Pinia) z `defineStore()` i re-eksportem z `index.ts`.
- **Typy**: Schematy Zod + wnioskowane typy TS (`z.infer<>`) w `client/src/types/index.ts`.
- **Testy**: Bun test runner, `describe()`/`it()`/`expect()`, Pinia testowe z `setActivePinia(createPinia())`.
- **Import komponentów**: Runtime value import (nie `import type`) dla komponentów Vue używanych w template.
- **API**: REST z prefiksem `/api`, JSON body/response, Zod walidacja po stronie klienta.
- **State management**: Pinia setup store z reaktywnym stanem i akcjami do mutacji.
- **3D rendering**: Three.js z MeshStandardMaterial, OrbitControls, raycasting do selekcji.
- **Stylowanie**: Tailwind CSS v4, klasy utility bezpośrednio w template.

---

## Tabele bazy danych

| Tabela | Opis |
|--------|------|
| `projects` | Projekty meblowe (nazwa, opis, rozmiar siatki, miniatura base64) |
| `furniture_objects` | Obiekty meblowe (wymiary, pozycja, rotacja, kolor, projekt) |
| `component_groups` | Grupy komponentów (synchronizacja wymiarów między obiektami) |
| `object_relations` | Relacje między obiektami (dimension/attachment) |
| `material_templates` | Szablony materiałów (nazwa, kolor bazowy) |
| `material_layers` | Warstwy materiałów (typ, kolor, grubość, strona, dwustronność) |
| `history_entries` | Wpisy historii (etykieta akcji, snapshot JSON, timestamp) |

---

*Ostatnia aktualizacja: 2026-04-01*
