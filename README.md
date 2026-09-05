# AgentsToZ Memory

Local-first, project-scoped memory for agents. Use the TypeScript SDK in your own platform, or give an agent the standalone setup prompt. No AgentsToZ app, account, database server or subscription is required by this package. Model and hosting costs remain yours when you connect an external provider.

**SDK v0.1.0 · extracted agent lineage v19 · MIT · Node.js 22+ · zero runtime dependencies**

이 저장소는 [AgentsToZ 앱 공개 배포 저장소](https://github.com/intenet1001-commits/AgentsToZ-public)에서 장기기억 기능을 독립적으로 활용하려는 개발자를 위한 첫 공개 SDK입니다. AgentsToZ 앱은 프로젝트·에이전트·기억을 한 화면에서 관리하는 통합 환경이고, 이 SDK는 다른 플랫폼에서 기억 기능을 직접 연결할 때 사용합니다. 앱 전체를 복제한 제품은 아닙니다.

- 앱: [AgentsToZ-public](https://github.com/intenet1001-commits/AgentsToZ-public)
- 독립 SDK: [AgentsToZ-memory](https://github.com/intenet1001-commits/AgentsToZ-memory)
- 짧은 에세이: [기억을 소유한다는 것](docs/essay.ko.md)
- 기술 비교 근거: [공식 문서 비교 노트](docs/comparison.ko.md)

## 설치: 버전을 고정해서 사용하기

배포 채널은 **GitHub Releases의 npm 호환 tarball**입니다. npm 레지스트리에 등록됐다고 가정하여 `npm install @agentstoz/memory`를 실행하지 마세요.

```sh
npm install --save-exact https://github.com/intenet1001-commits/AgentsToZ-memory/releases/download/v0.1.0/agentstoz-memory-0.1.0.tgz
```

`package-lock.json`을 보관하세요. [릴리스](https://github.com/intenet1001-commits/AgentsToZ-memory/releases)에는 SHA-256 체크섬과 변경 내역을 함께 제공합니다. 버전을 바꾸기 전 확인할 사항은 [업그레이드 가이드](docs/upgrading.md)에 있습니다. 아직 0.x이므로 API를 안정화하는 과정이며, 모든 새 버전이 모든 작업에서 더 높은 성능을 낸다는 뜻은 아닙니다.

## 방법 A: 플랫폼에 SDK 연결

```js
import { ProjectMemory, rememberSession } from '@agentstoz/memory';

// 사용자가 선택한 실제 프로젝트 디렉터리. 하위 폴더 자동 검색은 하지 않습니다.
const memory = new ProjectMemory('/absolute/path/to/project');
memory.initialize(); // 기존 기억이 있으면 보존하는 멱등 초기화

const before = memory.load();
memory.commit('## Decisions\n### Database\nUse SQLite for offline operation.\n', {
  expectedRevision: before.revision,
});
console.log(memory.recall('offline'));

// 선택 사항: 자신의 모델 호출을 어댑터로 주입하세요.
// 실제 모델 예제는 아니며, 서명과 저장 흐름을 보여 주는 결정적 예제입니다.
await rememberSession(memory, 'Verified requirement: offline operation.', {
  async consolidate({ previousMemory, sessionContext, instructions }) {
    // 여기서 승인된 모델을 호출할 수 있습니다. 전달/과금/보관 정책은 호출자 책임입니다.
    // 확인된 변경이 없다면 이전 기억을 그대로 반환합니다.
    return previousMemory;
  },
});
```

프로젝트마다 UUID와 저장 디렉터리가 분리됩니다. `commit`은 **전체 정제 문서의 다음 버전**을 받습니다. 부분 변경을 보낼 때는 먼저 기존 문서와 합치세요. 다른 저장과 충돌하면 자동 덮어쓰기 대신 `CONFLICT`로 중단합니다. 출력 검사·모델 오류가 발생해도 기존 HEAD는 유지됩니다. [실행 가능한 예제](examples/local-agent.mjs)도 제공합니다.

```sh
npx --no-install agentstoz-memory init /absolute/path/to/project
npx --no-install agentstoz-memory recall /absolute/path/to/project "offline"
npx --no-install agentstoz-memory show /absolute/path/to/project
```

CLI `commit <root> <expected-revision>`은 표준입력으로 정제된 Markdown을 받습니다. 전체 문서·기억 ID·리비전을 확인한 뒤 호출하세요. 원문 대화 파일을 입력하지 마세요. `show`와 `recall` 출력 역시 비공개 데이터일 수 있습니다.

## 방법 B: 기존 v19 파일형 기억 에이전트 설정

```sh
npx --no-install agentstoz-memory setup-prompt
```

출력된 프롬프트를 검토한 뒤 파일 편집 권한을 가진 에이전트에게 전달하면 `.agent-memory/CORE.md`, 주제별 `notes/`, 세션 `journal/`, 기억용 지침을 설정하는 절차를 안내합니다. **명령 자체는 프롬프트만 출력**하며 설치·업그레이드를 자동 실행하지 않습니다. 실제 파일 작업의 정확성은 사용하는 에이전트가 검증해야 합니다. 백업·ID 보존·구버전 업그레이드 절차가 프롬프트에 포함되어 있습니다.

v19 프롬프트에는 AgentsToZ의 영어 번역 우선 출력 규칙과 기존 지침의 관리 블록 갱신도 들어 있습니다. 사용 전에 확인하세요. SDK 방법 A는 전역 지침이나 persona를 수정하지 않습니다. Hermes 메뉴에 새 provider를 등록하는 플러그인은 이 배포에 포함되지 않습니다.

## 포함 범위와 경계

| 항목 | 독립 SDK 방법 A | v19 설정 프롬프트 방법 B |
|---|---|---|
| 원본 저장 | `.agent-memory-sdk/HEAD.json` 안의 Markdown | 에이전트가 설정하는 `.agent-memory/notes/` |
| 회상 | 앱에서 추출한 항목별 어휘 검색, 한·영 별칭, 최대 20개 | 색인에서 필요한 노트 선택 |
| 항목 식별 | 안정 ID와 본문 버전 해시 | 같은 ID 규약을 설정 지침에 포함 |
| 저장 이력 | 리비전 스냅샷, 충돌 차단 | 에이전트 수행 세션 일지·백업 절차 |
| 실행 주체 | 개발자의 함수 호출 | 사용자가 선택한 에이전트 |

두 저장 형식은 **서로 자동 동기화되지 않습니다**. 기존 앱 기억 폴더를 그대로 SDK 저장소로 취급하거나 두 작성기를 동시에 연결하지 마세요. 필요하면 정제 Markdown을 명시적으로 내보내고 `initialize(markdown)` 또는 리비전을 확인한 `commit`으로 가져오세요. 분해된 기억은 `CORE.md` 목차가 아니라 manifest 순서의 노트 본문을 합친 문서가 입력입니다. 초기화는 기존 기억을 덮어쓰지 않습니다.

독립 SDK에는 Supabase/GitHub 백업, 원격제어, 앱 UI, 자동 50·75·90% 체크포인트, 전체 journal 검색·계보 합병, 벡터 DB, 내장 LLM, Hermes provider 자동 설치가 **없습니다**. 해당 앱 기능과 혼동하지 않도록 의도적으로 분리했습니다. Git worktree를 하나의 기억으로 묶고 싶으면 호스트가 검증한 같은 canonical root를 전달해야 합니다.

## 보안과 평가

로컬 파일은 평문입니다. SDK 자체는 네트워크 요청·텔레메트리·자동 세션 수집을 하지 않지만, 주입한 모델 어댑터는 외부로 데이터를 전송할 수 있습니다. 출력 검사는 알려진 비밀·일부 식별자·긴 원문 중복을 거르는 **휴리스틱**이지 완전한 개인정보/프롬프트 주입 방어가 아닙니다. 정제 문서에 들어간 정보는 과거 스냅샷에도 남습니다. [보안·복구 경계](docs/security.md)를 읽어 주세요.

회상 점수·문서 품질 점수는 정답 확률이나 타 제품 대비 성능이 아닙니다. 이 릴리스는 기능·격리·충돌·업그레이드·패키지 설치를 검증하며, LongMemEval 등에서 경쟁 제품보다 우수하다는 측정 결과는 없습니다.

## 개발 및 재배포

```sh
npm ci --ignore-scripts
npm test
npm run check:package
npm pack
```

소스 출처와 조정 내용은 [NOTICE](NOTICE.md), 파일 해시는 [PROVENANCE.json](PROVENANCE.json)에 있습니다. 수정은 PR로 제안해 주세요. 재사용은 이 SDK의 [MIT 라이선스](LICENSE)를 따릅니다. 이 라이선스가 부모 앱 전체에 자동 적용되는 것은 아닙니다.
