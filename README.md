# skyguin-meblox

Aplikacja do projektowania mebli. Prosta jak budowa cepa.

![Widok 3D z siatką i elementem mebla](https://github.com/user-attachments/assets/6921f6d1-df31-48d4-aba2-dfd6c8995917)

## Stack technologiczny

- **Runtime aplikacji:** [Bun.js](https://bun.sh/) v1.x — jedna aplikacja, jeden runtime
- **Frontend:** [Vue 3](https://vuejs.org/) z Composition API + [Vite](https://vitejs.dev/)
- **3D:** [Three.js](https://threejs.org/) z WebGL
- **Stylowanie:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Walidacja:** [Zod](https://zod.dev/)
- **Baza danych:** SQLite (wbudowany w Bun: `bun:sqlite`, plik `database.sqlite` w repozytorium)
- **Język:** TypeScript

## Funkcje

- ✅ Widok 3D z siatką (konfigurowalna w mm/cm, niezależnie dla osi X/Y/Z)
- ✅ Dodawanie elementów mebli (szerokość, wysokość, głębokość w mm)
- ✅ Zaznaczanie, przesuwanie, obracanie elementów
- ✅ Duplikowanie elementów
- ✅ Zmiana koloru każdego elementu (paleta + picker)
- ✅ Szablony materiałów z warstwami na każdej ściance płyty
- ✅ Jednostronne/dwustronne warstwy (automatyczne dodanie na przeciwległą stronę)
- ✅ Komponenty – łączenie elementów z synchronizacją parametrów
- ✅ Tryb "edytuj osobno" – wyłącza synchronizację dla konkretnego elementu
- ✅ Zarządzanie projektami (wiele projektów)
- ✅ Persystencja w SQLite (offline, bez chmury)

## Uruchomienie

### Wymagania

- [Bun.js](https://bun.sh/) >= 1.0

### Instalacja zależności

```bash
# Tooling repo (Biome, Husky, typowanie serwera)
bun install

# Zależności aplikacji klienckiej pod Buna
cd client && bun install && cd ..
```

### Tryb deweloperski

```bash
# Główna aplikacja Bun (API + serwowanie buildu)
bun run dev

# Opcjonalnie: osobny dev server UI do szybkiej iteracji na froncie
bun run dev:ui
```

- `bun run dev` uruchamia jedną aplikację pod jednym runtime Bun na porcie `3001`
- `bun run dev:ui` wystawia tylko dev server Vite na porcie `5173`

### Produkcja

```bash
# Zbuduj klienta
bun run build

# Uruchom serwer (serwuje też zbudowanego klienta)
bun run start
```

Otwórz [http://localhost:3001](http://localhost:3001)

## Struktura projektu

```
skyguin-meblox/
├── server/                  # Bun.js backend
│   ├── index.ts             # Główny serwer HTTP + router
│   └── db/
│       └── database.ts      # SQLite – schemat i inicjalizacja
├── client/                  # Vue 3 frontend
│   ├── src/
│   │   ├── App.vue           # Główny komponent
│   │   ├── types/index.ts    # Typy TypeScript + Zod schemas
│   │   ├── composables/
│   │   │   ├── useAppStore.ts   # Globalny stan reaktywny
│   │   │   ├── useScene.ts      # Three.js 3D scena
│   │   │   └── useApi.ts        # REST API client
│   │   └── components/
│   │       ├── SceneCanvas.vue           # Płótno 3D + interakcja
│   │       ├── AddObjectDialog.vue       # Dialog dodawania elementu
│   │       ├── ObjectsPanel.vue          # Lista elementów
│   │       ├── ObjectPropertiesPanel.vue # Właściwości zaznaczonego
│   │       ├── MaterialsPanel.vue        # Szablony materiałów
│   │       ├── MaterialTemplateEditor.vue # Edytor szablonu
│   │       ├── SideTile.vue              # Kaffelek boku płyty
│   │       ├── GridSettingsPanel.vue     # Ustawienia siatki
│   │       ├── ComponentsPanel.vue       # Komponenty
│   │       └── ToolButton.vue            # Przycisk paska narzędzi
│   ├── vite.config.ts
│   └── package.json
├── database.sqlite          # Baza danych SQLite (w repozytorium)
└── package.json             # Root package.json
```

## Tooling jakości

- `bun run lint:fix` — Biome z autofixem
- `bun run lint` — kontrolny lint Biome
- `bun run typecheck` — TypeScript przez Buna (`tsc` dla serwera + `vue-tsc` dla klienta)
- `bun run test:run` — pełne testy w `bun test`
- `bun run verify:start` — build aplikacji i sprawdzenie, czy startuje i działa ponad 5 sekund

### Hooki Husky

**pre-commit**
- `bun run lint:fix`
- `bun run lint`
- `bun run typecheck`
- `bun run test:run`

**pre-push**
- `bun run verify:start`
