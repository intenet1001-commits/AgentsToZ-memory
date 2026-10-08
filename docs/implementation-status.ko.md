# 에세이의 구현 근거와 남은 검증

확인일: 2026-10-08(최초 2026-09-24). [「기억을 소유한다는 것」](essay.ko.md)의 통합 앱 설명을 코드와 대조한 기록이다. 이번 작업은 문서 개정이며 아래에 적은 것 외에는 앱의 전체 테스트, 실제 모델 호출, 설치·실기기 검증을 새로 실행한 결과가 아니다.

통합 앱의 로컬 기준은 `AgentsToZ_byCS` 커밋 `659fb60d2523f7ffc1d211364271d0650fc07312`이고, 아래 앱 링크는 같은 날 이 커밋에서 만든 공개 snapshot `ccbc76cf6f26730cf2995e244cfa41538d33b450`에 고정했다(공개용 치환 1건, 공개 제외 파일 138개). 9월 확인 때 공개 snapshot에 없던 OPS 발견·복원 수정도 이번 snapshot에는 포함되어 있다. 아래에 인용한 값(자동 저장의 입력·횟수·간격 한도, 임시 입력 만료, 피드백 승격 비활성화)은 이 snapshot에서 다시 확인했다. 공개 소스가 있다는 사실만으로 모든 설치본의 적용 상태를 주장하지 않는다.

독립 기억 SDK는 `package.json` 기준 **v0.3.0**(에이전트 계보 v23)이다. 에세이의 이전 공개 개정본은 `f353b777c7c606385ece4643d643125dded661c0`이며, 통합 앱의 발전이 SDK 기능·버전의 자동 갱신을 의미하지 않는다.

## 기록과 회상

| 에세이의 설명 | 확인한 근거 | 해석의 범위 |
|---|---|---|
| 요약 일지, 색인·주제별 노트, 피드백을 나누어 보관한다 | [앱 설명](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/README.md#프로젝트-장기기억), [문서 분할 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/projectMemoryDocument.ts) | journal은 정제한 요약 근거다. 원문 대화 전체의 보존이나 요약의 무오류를 보장하지 않는다. |
| 피드백의 긍정적 기록에 따른 자동 승격은 현재 꺼져 있다 | [피드백 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/projectMemoryFeedback.ts)의 `PROJECT_MEMORY_FEEDBACK_PROMOTION_ENABLED = false`, [회상 연결](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/project-memory-server.ts) | 이벤트 종류와 승격 계산 함수가 존재하는 것만으로 실제 회상에서 승격이 활성화됐다고 말할 수 없다. README의 일반적 피드백 설명보다 현재 코드의 비활성화 조건을 우선했다. |
| 독립 SDK는 명시적인 프로젝트 root와 어휘 기반 회상을 제공한다 | [SDK 범위](../README.md#포함-범위와-경계), [구현](../src/memory.ts), [추출한 회상 코드](../src/core/projectMemoryRecall.ts) | SDK의 `.agent-memory-sdk/HEAD.json`과 앱의 `.agent-memory/notes/`는 서로 자동 동기화되지 않는다. 앱의 journal 검색·자동 저장·원격 기능은 SDK에 포함되지 않는다. |

## 자동 저장과 복구

기존 Codex 체크포인트와 V2는 조건이 다르다. 체크포인트는 완료된 턴의 컨텍스트 사용률 50·75·90%와 프로젝트의 기억 갱신 필요 여부를 사용한다. V2는 별도의 연결 검사와 동의를 받으며 활성화할 때 기존 체크포인트를 끈다. 동의 후 완료된 Claude·Codex 대화를 대상으로 하며 파일 변경은 필수 조건이 아니다. 정리 제안을 만드는 현재 provider는 검증된 정확한 모델 ID와 low/medium 설정을 사용하는 Claude CLI다. [호스트 연결](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/memorySaveAutomaticHost.ts), [provider 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/memorySaveProvider.ts)

현재 V2는 한 번에 최대 8턴·대화 입력 20,000 bytes·프롬프트 48,000 bytes를 다룬다. 자동 정리는 120초 유휴를 기다리며, 최근 24시간 8회와 기억별 30분 간격을 적용한다. V2가 담당하는 프로젝트의 수동 저장에도 실행 한도가 적용된다. 한도 초과나 원본 확인 실패가 있으면 저장이 보류될 수 있으므로, 모든 완료 대화가 즉시 또는 반드시 저장된다는 뜻으로 읽으면 안 된다. [운영 계약](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/docs/resource-management.md), [횟수·동의 정책](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/memorySaveAutomaticPolicy.ts)

복구는 남아 있는 증거에 따라 구분한다. 원래 작업에 결속된 저장 계획과 실제 문서·일지·상태를 확인할 수 있으면 AI 재호출 없이 완료 기록을 확정한다. 계획과 응답을 확인할 수 없는 시도는 미확정으로 남긴다. 후자는 별도 검토·동의를 받은 후속 시도 하나만 허용하며 원래 시도의 이력을 성공으로 바꾸지 않는다. CLI가 갱신된 경우의 연결 검사와 기억 정리 동의도 별개다. 로컬 저장 완료와 백업 완료는 서로 다른 결과다. [완료 근거 적용](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/memorySaveHostCommit.ts), [복구·유지보수 계약](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/docs/resource-management.md)

정리 입력의 임시 암호문에는 7일 만료와 인증된 삭제 절차가 있다. 키·파일 문제가 생기면 원본을 보존하고 경고하므로 정확히 7일째 모든 사본이 사라진다는 보장은 아니다. 원래 CLI 대화 기록, 정제 기억, 백업은 별도의 보관 범위를 갖는다. 정제 Markdown 전체 암호화나 외부 모델 제공자의 데이터 보관 통제까지 구현한 것은 아니다. [입력 저장소](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/memorySaveInputStore.ts)

## OPS와 기기 간 연속성

현재 앱은 워크룸을 AI 실행의 중심으로 사용하고 OPS 운영기억의 관리 경로를 유지한다. 별도 AI 작업 탭과 앱 내부 CS CEO 선택 연동을 현재 제공 기능으로 서술하지 않는다. OPS 표시 이름, 공유 폴더 `AgentsToZ-OPS`(2026-09-29 `AgentsToZ-Control`에서 이름 변경), 프로젝트별 USE/DEV 기억과 실행 상태의 경계는 [운영 프로필 문서](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/docs/control-profile.md)를 따른다.

다른 Mac의 OPS 발견·복원에서는 기억 계보를 함께 전달한다. 등록 행에 기억 ID가 없을 때도 후보를 확인하되, 같은 이름으로 여러 기억이 발견되면 임의 선택하지 않는다. 명시된 기억 ID는 이름 기반 추정으로 덮지 않는다. [발견·복원 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/controlCenterProject.ts), [회귀 테스트](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/tests/control-center-discovery.test.ts) — 9월에는 로컬 커밋 `e5fe421`에만 있던 수정이며 이번 snapshot에 포함됐다.

폴더 이름을 바꿀 때는 Git 설정 `agentstoz.repositoryKey`에 옛 저장소 키를 고정해, 원격 주소가 바뀌어도 기억 레지스트리가 같은 기억 ID로 이어지게 한다. [이름 변경 절차](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/docs/control-profile.md), [이전 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/opsFolderMigration.ts)

10월 5일에는 앱 소스를 다른 폴더 이름으로 받아 둔 Mac이 복원 정보를 찾지 못하고 새 운영 프로필을 만든 일이 있었다. 지금은 등록된 폴더의 이름이 아니라 내용(앱 소스인지)으로 복원 정보를 고르고, 서로 다른 프로필을 가리키는 복원 정보가 둘 이상이면 `CONTROL_PROFILE_SEED_AMBIGUOUS`로 멈추며 새 프로필을 만들지 않는다. [복원 정보 선택](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/control-profile-server.ts), [회귀 테스트](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/tests/control-profile-restore.test.ts). 이것은 새로 만들어진 프로필을 막는 장치이며, 이미 갈라진 기록을 자동으로 합치지는 않는다(그때 생긴 고아 프로필 기록은 운영자가 정리했다).

일상 동기화는 로컬·원격 내용과 마지막 동기화 기준을 비교한다. 양쪽 변경은 충돌 검토 대상이며 백업 실패가 완료된 로컬 저장을 취소하지 않는다. Private GitHub 보관은 별도 opt-in이고, 공개 여부·쓰기 권한·저장소 정체성을 Push 직전에 검사하는 재해복구용 사본이다. 현재 전체 snapshot/tree 대조 비용은 누적량에 비례한다. [백업 설명](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/README.md#백업과-복구), [Private 보관 구현](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/src/projectMemoryPrivateGitHubArchive.ts)

모바일 기록 조회와 기억 저장에는 기존 터미널 연결과 별개인 프로젝트별 권한을 적용한다. 승인·접수된 저장은 휴대폰 연결이 끊겨도 호스트에서 계속 처리하고 로컬 저장·백업 결과를 구분한다. fixture·브라우저 검증 기록은 있으나 실제 승인된 휴대폰과 설치 앱의 전체 통합 흐름, 모바일 전용 미확정 영수증 복구 화면 등은 후속 범위다. [모바일 실행 기록](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/docs/plans/mobile-workspace-2026-09-11/EXECUTION.md)

## 경험이 공통 규칙이 되는 경로

통합 앱의 프로젝트 검사는 두 층으로 나뉜다. 앱이 버전을 붙여 나눠 주는 공통 러너·공통 시나리오와, 각 프로젝트가 자기 Git에 두는 고유 검사다. 공통 러너는 현재 1.5.1이다. [러너](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/scripts/agentstoz-maintainer.py)

- **후보 수집은 읽기 전용이다.** `scenarios promote`는 프로젝트 시나리오마다 실행 기록(통과·실패·차단 횟수, 흔들림)과 다른 프로젝트로 옮길 수 있는지를 적어 `candidate.*` 후보를 내놓을 뿐 어떤 파일도 쓰지 않는다(`"writes": []`). 공통 계층이 모든 프로젝트로 퍼지는 경로는 이 저장소의 커밋, 러너 버전 상승, 일괄 갱신뿐이다.
- **페르소나 검사의 판정은 테스트 종료 코드뿐이다.** 러너는 AI를 부르지 않는다. 테스트가 하나도 없는 페르소나는 거절한다.
- **AI 탐색은 관찰이다.** `personas brief`가 만든 탐색 지시문은 워크룸에 초안으로만 들어가고, 탐색 결과는 `exploratory/observed` 기록으로 남아 통과·실패 판정·실행 이력·통계에 섞이지 않는다. 확인된 결함은 정해진 결과를 내는 회귀 테스트로 만들어 그 페르소나의 테스트 목록에 더해야 판정에 들어간다. [경계 테스트](https://github.com/intenet1001-commits/AgentsToZ-public/blob/ccbc76cf6f26730cf2995e244cfa41538d33b450/tests/maintainer/test_personas.py)

이 절은 소스와 기존 테스트 기록을 확인한 결과다. AI 탐색 검사가 실제로 얼마나 많은 결함을 찾는지는 아직 측정하지 않았다.

## 주장하지 않는 성과

회의를 기록해 다음 업무에 쓰자는 서술은 활용 방향이다. 범용 회의 녹음·전사·자동 지식화가 모두 구현됐다는 뜻이 아니다. 계획 중이거나 별도 작업 중인 음성 기능도 이번 에세이의 완료 기능에 넣지 않았다.

소스와 기존 검증 기록을 확인한 것으로 모든 Mac·Windows 설치본, 장기간 운영, 전원 손실 상황을 검증했다고 말하지 않는다. 10월 8일 기준 Mac 두 대와 Windows PC 한 대가 같은 커밋으로 빌드한 앱을 쓰고 있지만, 이것이 Windows에서의 기억 기능 전체를 검증했다는 뜻은 아니다. LongMemEval 수행 결과나 타 제품 대비 정확도·비용 우위도 제시하지 않는다. 외부 제품의 비교 기준과 향후 평가 항목은 [비교 근거 노트](comparison.ko.md)에 있다.
