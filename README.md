# skyguin-meblox

Aplikacja do projektowania mebli. Prosta jak budowa cepa.

![Widok 3D z siatką i elementem mebla](https://github.com/user-attachments/assets/6921f6d1-df31-48d4-aba2-dfd6c8995917)

## Stack technologiczny

- **Runtime:** [Bun.js](https://bun.sh/) v1.x
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
# Zainstaluj zależności serwera
bun install

# Zainstaluj zależności klienta (używa npm lub bun)
cd client && bun install && cd ..
# lub: cd client && npm install && cd ..
```

### Tryb deweloperski

```bash
# Terminal 1 – serwer API (port 3001)
bun run dev

# Terminal 2 – klient Vite dev server (port 5173)
bun run dev:client
```

Otwórz [http://localhost:5173](http://localhost:5173)

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
