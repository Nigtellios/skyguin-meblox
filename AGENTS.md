# AGENTS.md

Instrukcje dla każdego agenta AI pracującego w tym repozytorium.

## Zasady obowiązkowe

1. **Każda zmiana zachowania wymaga pokrycia testami.**
   - Zmieniasz logikę klienta lub serwera → dodaj/aktualizuj testy jednostkowe lub integracyjne.
   - Zmieniasz UI, zachowanie sceny 3D, projekty, thumbnail capture, boot aplikacji lub flow użytkownika → dodaj/aktualizuj odpowiednie testy regresyjne.

2. **Nigdy nie kończ pracy bez uruchomienia pełnej walidacji zgodnej z Husky.**
   To jest wymagany zestaw lokalny przed zakończeniem pracy — dokładnie po to, żeby commit i push nie wyłożyły się później na hookach:
   ```bash
   bun run lint:fix
   bun run lint
   bun run typecheck
   bun run test:run
   bun run test:regression
   bun run verify:start
   ```

3. **Dla zmian wpływających na UI lub przepływy użytkownika uruchom też regresję Playwright.**
   Obowiązkowo dla zmian dotyczących m.in.:
   - `client/src/App.vue`
   - `client/src/components/**`
   - `client/src/composables/useScene/**`
   - `client/src/composables/useAppStore/**`
   - projektów, dashboardu, modali, canvasu, renderowania, thumbnail capture

   Komenda:
   ```bash
   bun run test:regression
   ```

4. **W odpowiedzi końcowej zawsze raportuj, co uruchomiłeś i z jakim wynikiem.**
   Podaj przynajmniej:
   - czy przeszedł `lint`
   - czy przeszedł `typecheck`
   - czy przeszedł `bun test`
   - czy została uruchomiona regresja Playwright i z jakim wynikiem
   - czy przeszedł `verify:start`

5. **Nie osłabiaj istniejących testów ani regresji.**
   Jeśli test jest kruchy, napraw go tak, by lepiej sprawdzał zachowanie, zamiast go usuwać lub spłycać.

## Dodatkowe guardy dla tego repo

- Komponenty Vue używane w template muszą być importowane jako **runtime value**, a nie `import type`.
- Zmiany w lifecycle `SceneCanvas` i `useScene` muszą zachować jednocześnie:
  - poprawne renderowanie canvasu
  - poprawny cleanup/remount sceny
  - działający thumbnail capture
- Zmiany w projektach/dashboardzie muszą być sprawdzone w pełnym flow:
  - otwarcie projektu
  - powrót do projektów
  - ponowne wejście do projektu

## Standardowa kolejność pracy

```bash
bun run lint:fix
bun run lint
bun run typecheck
bun run test:run
bun run test:regression
bun run verify:start
```

## Źródło prawdy dla walidacji

- Agenci mają traktować hooki `Husky` jako obowiązkowe bramki jakości.
- To znaczy:
  - wszystko z `pre-commit` musi przejść przed uznaniem zadania za skończone,
  - wszystko z `pre-push` też musi zostać uruchomione lokalnie, jeśli agent kończy zmianę gotową do wypchnięcia.
- Jeżeli lokalnie nie przechodzi którykolwiek z kroków `lint`, `typecheck`, `test:run`, `test:regression` albo `verify:start`, agent nie może twierdzić, że praca jest zakończona.

