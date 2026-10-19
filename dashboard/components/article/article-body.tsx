"use client";

import type { PaperSummary } from "@/lib/types";
import { FadeIn } from "@/components/fade-in";
import { Chapter, Figure, P, Prose, Pull } from "./prose";
import {
  L1ConditionHeatmap,
  L1Identification,
  L1Signatures,
} from "@/components/sections/layer1-observation";
import {
  L2EffectSize,
  L2EntropyScatter,
  L2Temporal,
} from "@/components/sections/layer2-decoupling";
import {
  L3Compliance,
  L3Design,
  L3ObsInj,
  L3Transfer,
} from "@/components/sections/layer3-injection";


/** Opening paragraphs, shown right below the lead figure. */
export function ArticleIntro() {
  return (
    <Prose className="pt-10 sm:pt-12">
      <P
        en="Large language model (LLM) agents are moving beyond answering questions. They can now use tools, plan multi-step tasks, and carry out complex workflows with increasing autonomy. This shift is particularly visible in cybersecurity, where AI agents can explore web applications, identify potential vulnerabilities, choose attack techniques, and verify whether their attempts succeed."
        ko="최근 LLM 기반 AI 에이전트는 단순히 질문에 답하는 수준을 넘어, 스스로 도구를 사용하고 여러 단계를 거쳐 복잡한 작업을 수행할 수 있게 되었습니다. 사이버보안 분야에서도 이러한 변화는 뚜렷합니다. AI 에이전트가 웹 애플리케이션의 취약점을 탐색하고, 공격 방법을 선택하며, 실제 공격 성공 여부까지 확인하는 일이 가능해졌습니다."
      />
      <P
        en={<>But this raises an interesting question: <strong>When different AI agents are given the same security testing task, do they approach it in the same way?</strong></>}
        ko={<>그런데 여기서 한 가지 흥미로운 질문이 생깁니다. <strong>서로 다른 AI 에이전트에게 같은 시스템을 점검하도록 맡기면, 과연 비슷한 방식으로 접근할까요?</strong></>}
      />
      <P
        en="One agent might start with SQL injection, while another may focus on authentication bypass or information disclosure. Are these differences simply random, or do agents exhibit consistent patterns in how they choose their attacks?"
        ko="예를 들어 어떤 에이전트는 SQL 인젝션부터 확인하고, 다른 에이전트는 인증 우회나 정보 노출 가능성을 먼저 살펴볼 수 있습니다. 이러한 차이가 단순한 우연인지, 에이전트마다 반복적으로 나타나는 행동 특성인지는 아직 충분히 연구되지 않았습니다."
      />
      <P
        en="Most existing benchmarks focus on outcomes, such as whether an agent successfully exploits a vulnerability or how many vulnerabilities it discovers. Yet two agents with similar success rates may take very different paths to reach those results. An agent's preferred attacks may not even be the ones it performs best."
        ko="기존 벤치마크는 주로 AI 에이전트가 공격에 성공했는지, 얼마나 많은 취약점을 발견했는지에 집중해 왔습니다. 하지만 최종 성공률이 비슷한 두 에이전트라도 그 결과에 도달하는 과정은 전혀 다를 수 있습니다. 더 나아가 에이전트가 자주 선택하는 공격이 실제로 가장 잘 수행하는 공격인지도 별개의 문제입니다."
      />
      <P
        en={<>To investigate these questions, we developed <strong>CyBiasBench</strong>, a benchmark designed to systematically study how LLM agents select cyberattack techniques and how those choices relate to their actual performance.</>}
        ko={<>이러한 질문을 살펴보기 위해 우리는 <strong>CyBiasBench</strong>를 개발했습니다. CyBiasBench는 사이버 공격 시나리오에서 LLM 에이전트가 어떤 공격을 선택하고, 그 선택이 실제 성능과 어떻게 연결되는지를 체계적으로 분석하는 벤치마크입니다.</>}
      />
    </Prose>
  );
}

export function ArticleChapters({ data }: { data: PaperSummary }) {
  return (
    <>
      {/* ── 1 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-1"
        num={1}
        en="Different agents make different choices, even on the same task"
        ko="같은 과제를 주어도 AI 에이전트의 선택은 달랐습니다"
      >
        <Prose>
          <P
            en="We evaluated five AI agents: Claude Opus 4.5, GPT-5.2 Codex, Gemini 2.5 Pro, Kimi k2.5, and GLM 5.1. Our test environments included OWASP Juice Shop, a widely used security testing application; MLflow 2.9.2, which contains known vulnerabilities; and Vuln Shop, a custom e-commerce application developed to provide a controlled set of vulnerabilities."
            ko="이번 연구에서는 Claude Opus 4.5, GPT-5.2 Codex, Gemini 2.5 Pro, Kimi k2.5, GLM 5.1 등 다섯 가지 AI 에이전트를 평가했습니다. 실험 환경에는 널리 사용되는 보안 테스트 애플리케이션인 OWASP Juice Shop, 알려진 취약점이 있는 MLflow 2.9.2, 그리고 취약점 구성을 직접 통제할 수 있도록 개발한 Vuln Shop을 사용했습니다."
          />
          <P
            en="To ensure a consistent evaluation environment, all agents had access to the same Kali Linux-based tools and ran within isolated Docker networks. Rather than relying on agents' self-reported actions, we analyzed actual HTTP requests and responses to identify attack behavior and verify outcomes."
            ko="모든 에이전트에는 동일한 Kali Linux 기반 도구 환경을 제공했습니다. 또한 Docker 네트워크를 분리해 다른 에이전트의 실행이 결과에 영향을 주지 않도록 했습니다. 공격 행동은 에이전트의 자체 보고가 아니라 실제 HTTP 요청과 응답을 분석해 확인했습니다."
          />
          <P
            en={<>The evaluation consisted of two stages. First, we allowed agents to choose their own attack techniques. We then examined how their behavior changed when explicitly instructed to focus on a particular attack category. Across four prompting conditions that varied the level of guidance and output structure, we analyzed <strong>630 sessions in total</strong>: 180 free-choice sessions and 450 targeted-instruction sessions.</>}
            ko={<>실험은 크게 두 단계로 진행했습니다. 먼저 에이전트가 자유롭게 공격 방법을 선택하도록 한 뒤, 특정 공격 계열을 직접 지정했을 때 행동이 어떻게 달라지는지 살펴봤습니다. 프롬프트의 유도 수준과 출력 형식을 달리한 네 가지 조건을 포함해, 자유 선택 세션 180회와 공격 계열 지정 세션 450회, 총 <strong>630회의 세션</strong>을 분석했습니다.</>}
          />
          <P
            en="The first finding was striking: different agents consistently favored different types of attacks."
            ko="가장 먼저 눈에 띈 것은 에이전트마다 공격을 선택하는 방식이 상당히 다르다는 점이었습니다."
          />
          <P
            en="For example, Claude allocated 25.3% of its attempts to information disclosure, while Codex favored the same category even more strongly, at 31.5%. Gemini and Kimi most frequently selected SQL injection, whereas GLM showed a stronger tendency toward authentication bypass."
            ko="예를 들어 Claude는 정보 노출(Information Disclosure) 계열에 전체 시도의 25.3%를 배분했고, Codex 역시 같은 계열을 가장 많이 선택했지만 그 비중은 31.5%로 더 높았습니다. 반면 Gemini와 Kimi는 SQL 인젝션을 가장 자주 선택했으며, GLM은 인증 우회(Authentication Bypass)를 상대적으로 많이 시도했습니다."
          />
          <P
            en="Agents also differed in how broadly they explored available techniques. Claude attempted an average of 7.8 distinct attack categories per session, compared with just 3.1 for Gemini. Some agents explored a wide range of possibilities, while others concentrated their efforts on a smaller set of techniques."
            ko="공격을 얼마나 다양하게 탐색하는지도 달랐습니다. Claude는 세션당 평균 7.8개의 공격 계열을 시도한 반면, Gemini는 평균 3.1개 계열에 집중했습니다. 어떤 에이전트는 여러 가능성을 폭넓게 탐색하고, 다른 에이전트는 소수의 공격 방식에 자원을 집중하는 셈입니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L1Signatures data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="These differences were statistically significant. Comparing the entropy of attack-category selection revealed a strong agent-specific effect (Kruskal–Wallis, p = 3.64 × 10⁻¹⁶, η² = 0.426)."
            ko="이 차이는 통계적으로도 뚜렷했습니다. 공격 계열 선택의 다양성을 나타내는 엔트로피를 비교한 결과, 에이전트 간 차이는 매우 유의했으며(Kruskal–Wallis, p = 3.64 × 10⁻¹⁶), 효과크기 역시 크게 나타났습니다(η² = 0.426)."
          />
          <P
            en={<>Even more interestingly, these patterns remained relatively stable across prompting conditions. When we trained a classifier using only the proportions of attacks assigned to ten categories, it identified the agent with <strong>65% accuracy</strong>, compared with a 20% random baseline. In other words, an agent&apos;s attack-selection profile was distinctive enough to act as a behavioral fingerprint.</>}
            ko={<>더 흥미로운 점은 이러한 차이가 프롬프트를 바꿔도 비교적 안정적으로 유지됐다는 것입니다. 실제로 10개 공격 계열에 대한 선택 비중만으로 에이전트를 식별하는 분류기를 학습했을 때, <strong>65%의 정확도</strong>를 얻었습니다. 무작위 추측의 기준선이 20%라는 점을 고려하면, 공격 선택 패턴에 에이전트별 특징이 상당히 담겨 있다는 뜻입니다.</>}
          />
        </Prose>
        <Figure>
          <FadeIn><L1ConditionHeatmap data={data} /></FadeIn>
        </Figure>
        <Figure>
          <FadeIn><L1Identification data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="This does not necessarily mean that models have fixed, inherent preferences for particular attacks. Their decisions also depend on which vulnerabilities are available, how easily those vulnerabilities can be discovered, and how difficult they are to exploit. Nevertheless, the results show that different agents exhibit distinguishable and relatively consistent behavioral patterns, even when evaluated in the same environment."
            ko="물론 이것을 모델이 본질적으로 특정 공격을 선호한다는 증거로 해석해서는 안 됩니다. 실제 선택에는 표적 시스템에 존재하는 취약점, 발견하기 쉬운 정도, 공격을 실행하는 데 필요한 노력도 함께 영향을 줍니다. 다만 동일한 실험 환경에서도 에이전트마다 반복적으로 구분되는 행동 패턴이 나타났다는 점은 분명합니다."
          />
        </Prose>
      </Chapter>

      {/* ── 2 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-2"
        num={2}
        en="The attacks agents prefer are not necessarily the ones they perform best"
        ko="자주 선택하는 공격이 반드시 잘하는 공격은 아닙니다"
      >
        <Prose>
          <P
            en="Once we established that agents differ in their attack-selection patterns, we asked a related question:"
            ko="에이전트마다 선호하는 공격 방식이 다르다는 사실을 확인한 다음, 우리는 한 걸음 더 나아갔습니다."
          />
          <Pull
            en="Do agents tend to choose the attacks they are most likely to succeed at?"
            ko="에이전트가 자주 선택하는 공격이 실제로도 가장 성공률이 높은 공격일까요?"
          />
          <P
            en="It would be reasonable to expect so. As an agent explores a target, it might allocate more effort to techniques that are likely to work."
            ko="직관적으로는 그렇다고 생각하기 쉽습니다. AI 에이전트가 여러 공격 방법을 탐색하면서 효과적인 방법에 더 많은 자원을 배분할 것이라고 기대할 수 있기 때문입니다."
          />
          <P en="Our results, however, suggest otherwise." ko="하지만 실험 결과는 달랐습니다." />
          <P
            en="Codex devoted 31.5% of its attempts to information disclosure, but its success rate for that category was only 22.1%. Meanwhile, it achieved a 100% success rate on file-upload attacks, despite not selecting them most frequently."
            ko="Codex는 전체 공격 시도의 31.5%를 정보 노출 계열에 사용했지만, 해당 계열의 공격 성공률은 22.1%였습니다. 반면 파일 업로드 계열에서는 100%의 성공률을 기록했음에도 이를 가장 많이 선택하지는 않았습니다."
          />
          <P
            en="We observed a similar mismatch with Claude. Information disclosure was its most frequently selected category, with a 44.3% success rate, yet it performed better on insecure direct object reference (IDOR) attacks, achieving 57.1%. Gemini also favored SQL injection while achieving its highest category-specific success rate on IDOR."
            ko="Claude에서도 비슷한 차이가 나타났습니다. 가장 많이 선택한 정보 노출 계열의 성공률은 44.3%였지만, IDOR 계열에서는 57.1%를 기록했습니다. Gemini 역시 SQL 인젝션을 가장 자주 선택했지만, 실제 성공률은 IDOR에서 가장 높았습니다."
          />
          <P
            en={<>These examples reveal a substantial gap between <strong>where agents spend their effort and where they actually perform well</strong>. The radar and table at the top of this page show the full picture for every agent.</>}
            ko={<>즉, <strong>에이전트가 많은 자원을 투입하는 공격과 실제로 높은 성과를 내는 공격 사이에는 상당한 간극이 있었습니다.</strong> 에이전트별 전체 모습은 이 페이지 맨 위의 레이더와 표에서 확인할 수 있습니다.</>}
          />
          <P
            en="The difference was also apparent in our statistical analysis. Measures describing the diversity and concentration of attack selection showed strong differences across agents, while the effect size for overall session attack success rate (ASR) was much smaller (η² = 0.047), compared with 0.426 for attack-selection entropy."
            ko="이 차이는 전체 지표에서도 확인됐습니다. 공격 선택의 다양성과 집중도를 나타내는 지표는 에이전트 간 차이를 크게 보여준 반면, 최종 세션 공격 성공률(ASR)의 효과크기는 η² = 0.047에 그쳤습니다. 공격 계열 엔트로피의 효과크기인 0.426과 비교하면 차이가 큽니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L2EffectSize data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="We also examined whether exploring more attack categories leads to better outcomes. Only Codex showed a statistically significant positive correlation between session entropy and ASR (Spearman ρ = 0.426, p = 0.010). The other four agents showed no significant relationship."
            ko="공격을 다양하게 시도하는 것이 성공률 향상으로 이어지는지도 살펴봤습니다. 그 결과 Codex에서만 약한 양의 상관이 관찰됐고(Spearman ρ = 0.426, p = 0.010), 나머지 네 에이전트에서는 유의한 관계가 나타나지 않았습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L2EntropyScatter data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="This finding has important implications for evaluating AI agents. Similar success rates can conceal very different behavioral strategies, while broader exploration does not necessarily indicate better performance."
            ko="이 결과는 AI 에이전트를 평가할 때 중요한 시사점을 제공합니다. 단순히 성공률만 비교하면 서로 다른 행동 특성을 가진 에이전트를 비슷하게 평가할 수 있습니다. 반대로 다양한 공격을 시도한다고 해서 더 우수한 에이전트라고 판단하는 것도 적절하지 않습니다."
          />
          <Pull
            en="What an agent chooses to do and what it is capable of doing well are two different things."
            ko="무엇을 선택하는지와 실제로 무엇을 잘하는지는 구분해서 봐야 합니다."
          />
        </Prose>
      </Chapter>

      {/* ── 3 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-3"
        num={3}
        en="Failure does not necessarily make agents change strategy"
        ko="실패했다고 해서 반드시 전략을 바꾸지는 않았습니다"
      >
        <Prose>
          <P
            en="We also investigated how agents adapt their choices during an attack session."
            ko="우리는 에이전트가 공격 과정에서 자신의 선택을 얼마나 유연하게 조정하는지도 살펴봤습니다."
          />
          <P
            en="A human security analyst who repeatedly fails with one technique might switch to another vulnerability or reconsider their approach. Do AI agents respond to failure in the same way?"
            ko="사람이 보안 테스트를 수행한다면 특정 공격이 반복해서 실패할 경우 다른 취약점이나 공격 방법으로 방향을 바꾸는 것이 자연스럽습니다. AI 에이전트도 비슷하게 행동할까요?"
          />
          <P
            en="To explore this, we compared how often agents switched attack categories after successful and unsuccessful attempts."
            ko="이를 확인하기 위해 공격 성공 이후와 실패 이후에 다른 공격 계열로 전환하는 비율을 비교했습니다."
          />
          <P
            en="Surprisingly, the rate of switching after failure was similar to the rate of switching after success. In other words, agents did not consistently become more likely to change their approach simply because an attack failed."
            ko="흥미롭게도 실패 후 전환 비율은 성공 후 전환 비율과 비슷한 수준이었습니다. 다시 말해 공격이 실패했다고 해서 에이전트가 특별히 더 적극적으로 전략을 수정하는 경향은 나타나지 않았습니다."
          />
        </Prose>
        {data.temporal_adaptation && data.temporal_adaptation.length > 0 && (
          <Figure>
            <FadeIn><L2Temporal data={data} /></FadeIn>
          </Figure>
        )}
        <Prose>
          <P
            en="This helps explain some of the mismatch between attack selection and performance. Even when an agent repeatedly attempts a relatively ineffective technique, failure does not necessarily push it toward a different category."
            ko="이는 앞서 관찰한 선택과 성능의 불일치를 이해하는 데 도움이 됩니다. 에이전트가 효과가 낮은 공격을 반복적으로 선택하더라도, 실패 경험이 반드시 다른 공격 계열로의 전환을 유도하지는 않는다는 것입니다."
          />
          <P
            en="For autonomous security agents, this suggests that executing attacks successfully is only part of the challenge. Equally important is the ability to interpret unsuccessful attempts and use that feedback to guide subsequent decisions."
            ko="따라서 자율적인 보안 에이전트를 설계할 때는 공격 실행 능력뿐 아니라, 실패를 어떻게 해석하고 다음 전략에 반영하는지도 중요하게 고려할 필요가 있습니다."
          />
        </Prose>
      </Chapter>

      {/* ── 4 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-4"
        num={4}
        en="Can explicit instructions overcome an agent's existing preferences?"
        ko="그렇다면 공격 방법을 직접 지정하면 더 나아질까요?"
      >
        <Prose>
          <P
            en="If agents do not naturally prioritize the techniques they perform best, could we improve their behavior by telling them which attacks to use?"
            ko="앞선 결과에서 에이전트의 선택과 실제 성능이 일치하지 않는 경우가 많다는 사실을 확인했습니다. 그렇다면 사용자가 공격 계열을 명시적으로 지정하면 이 문제를 줄일 수 있을까요?"
          />
          <P
            en="To investigate this, we conducted a second experiment in which agents were explicitly instructed to focus on one of ten attack categories, including SQL injection, cross-site scripting (XSS), and authentication bypass. Everything else—including the environment, available tools, and success-verification process—remained unchanged."
            ko="이를 알아보기 위해 두 번째 실험을 진행했습니다. 첫 번째 실험과 동일한 환경에서 에이전트에게 SQL 인젝션, XSS, 인증 우회 등 10개 공격 계열 가운데 하나를 지정하고, 해당 계열을 중심으로 테스트하도록 했습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L3Design data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en={<>We focused on two questions. First, how closely would agents follow the specified attack category? We measured this using <strong>compliance</strong>, defined as the proportion of attempts belonging to the instructed category. Second, would these instructions improve actual attack success rates?</>}
            ko={<>이 과정에서 우리는 두 가지를 살펴봤습니다. 하나는 에이전트가 지시받은 공격 계열을 실제로 얼마나 시도하는지 나타내는 <strong>순응도(Compliance)</strong>이고, 다른 하나는 이러한 지시가 실제 공격 성공률을 개선하는지입니다.</>}
          />
          <P
            en="The results revealed an interesting relationship. Compliance was positively correlated with how frequently an agent had selected the same attack category during free-choice sessions (ρ = 0.529, p = 7.73 × 10⁻⁵)."
            ko="먼저 순응도는 에이전트가 자유 선택 상황에서 해당 공격을 얼마나 자주 시도했는지와 유의한 양의 상관을 보였습니다(ρ = 0.529, p = 7.73 × 10⁻⁵)."
          />
          <P
            en="In contrast, an agent's previous success rate in that category was not significantly associated with compliance (ρ = −0.248, Bonferroni-adjusted p = 0.083)."
            ko="반면 해당 공격 계열에서 원래 얼마나 높은 성공률을 보였는지는 순응도와 유의한 관계가 없었습니다(ρ = −0.248, Bonferroni 보정 후 p = 0.083)."
          />
        </Prose>
        <Figure>
          <FadeIn><L3Compliance data={data} /></FadeIn>
        </Figure>
        <Prose>
          <Pull
            en="Put simply, agents were more likely to follow instructions targeting attacks they already tended to choose, rather than attacks they were particularly good at."
            ko="쉽게 말하면, 에이전트는 원래 잘하던 공격보다 원래 자주 선택하던 공격에 대한 지시를 더 잘 따르는 경향을 보였습니다."
          />
          <P
            en={<>We refer to this relationship as <strong>bias momentum</strong>: the tendency for an agent&apos;s existing attack-allocation pattern to remain associated with its behavior even when explicit instructions are introduced.</>}
            ko={<>우리는 자유 선택 상황의 배분 패턴이 명시적인 지시 상황의 순응도와 연결되는 이러한 현상을 <strong>편향 관성(Bias Momentum)</strong>이라고 정의했습니다.</>}
          />
          <P
            en="Importantly, bias momentum should not be interpreted as proof of a fixed internal preference or a causal mechanism. In this study, it describes an observed behavioral relationship within the evaluated security environments."
            ko="다만 편향 관성은 모델 내부의 고정된 성향이나 인과적 메커니즘이 확인됐다는 의미는 아닙니다. 이번 연구에서는 실제 공격 환경에서 관찰되는 행동상의 연관성을 설명하는 개념으로 사용했습니다."
          />
        </Prose>
      </Chapter>

      {/* ── 5 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-5"
        num={5}
        en="Telling agents what to attack did not improve overall performance"
        ko="명시적인 지시가 공격 성공률을 높이지는 않았습니다"
      >
        <Prose>
          <P
            en="The next question was whether explicitly specifying attack techniques would improve success rates. Overall, it did not."
            ko="그렇다면 공격 계열을 지정했을 때 실제 성능은 어떻게 달라졌을까요? 결과적으로 특정 공격 계열을 명시적으로 지정하는 것만으로는 전체 평균 세션 ASR이 개선되지 않았습니다."
          />
          <P
            en="Across the five agents, the equally weighted average change in session ASR was −5.82 percentage points. Gemini's ASR decreased from 31.75% to 18.13%, while Codex dropped from 21.35% to 14.06%. Claude and GLM showed comparatively smaller changes."
            ko="다섯 에이전트의 균등 평균 ASR 변화는 −5.82%p였습니다. Gemini에서는 31.75%에서 18.13%로, Codex에서는 21.35%에서 14.06%로 감소했습니다. 반면 Claude와 GLM은 상대적으로 변화가 작았습니다."
          />
          <P
            en="However, the 95% confidence intervals for three individual agents included zero. These results therefore do not establish that explicit attack instructions consistently reduce performance across all agents."
            ko="다만 개별 에이전트 3종의 95% 신뢰구간에는 0이 포함됐기 때문에, 모든 에이전트에서 성능이 일관되게 감소한다고 결론 내릴 수는 없습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L3ObsInj data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="What matters here is that compliance and success rate behaved differently. Following an instruction more closely did not necessarily translate into better attack outcomes. In fact, compliance showed no significant correlation with session ASR (ρ = −0.082, p = 0.573)."
            ko="여기서 주목할 점은 순응도와 공격 성공률이 서로 다른 양상을 보였다는 것입니다. 사용자가 지정한 공격 계열을 얼마나 충실하게 따르는지가 높은 성공률을 보장하지는 않았습니다. 실제로 순응도와 세션 ASR 사이에는 유의한 상관이 나타나지 않았습니다(ρ = −0.082, p = 0.573)."
          />
          <P
            en={<>At the same time, <strong>agents&apos; relative strengths across attack categories remained largely consistent between the two experimental settings</strong>.</>}
            ko={<>반면 <strong>계열별 공격 능력 자체는 실험 조건이 달라져도 비교적 안정적으로 유지</strong>됐습니다.</>}
          />
          <P
            en="Category-specific success rates under free-choice and targeted-instruction conditions showed a strong positive correlation (ρ = 0.702, p = 1.38 × 10⁻⁸). This relationship was statistically significant for four of the five agents, with Gemini being the exception."
            ko="자유 선택 조건과 강제 주입 조건에서 측정한 계열별 ASR 사이에는 강한 양의 상관이 나타났습니다(ρ = 0.702, p = 1.38 × 10⁻⁸). 다섯 에이전트 가운데 네 에이전트에서 이러한 관계가 유의했으며, Gemini는 예외였습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L3Transfer data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="This suggests that while prompting can change the conditions under which an agent operates, its relative strengths across attack categories often persist."
            ko="이는 프롬프트를 변경하거나 특정 공격 계열을 지정하더라도, 에이전트가 어떤 공격을 상대적으로 잘 수행하는지에 대한 성능 구조는 상당 부분 유지된다는 의미입니다."
          />
          <P
            en={<>The distinction is important: <strong>changing an agent&apos;s instructions is not the same as improving its underlying capabilities</strong>. Simply emphasizing a particular attack technique in a prompt may not be enough to produce a more effective security-testing strategy.</>}
            ko={<>정리하면, <strong>지시를 바꾸는 것과 에이전트의 실제 능력을 바꾸는 것은 다른 문제</strong>입니다. 단순히 프롬프트에서 특정 공격을 강조하는 방식만으로 더 효과적인 공격 전략을 유도하기는 어렵다는 점을 보여줍니다.</>}
          />
        </Prose>
      </Chapter>

      {/* ── 6 ─────────────────────────────────────────────────────────── */}
      <Chapter
        id="findings-6"
        num={6}
        en="What CyBiasBench tells us about evaluating AI agents"
        ko="CyBiasBench가 AI 에이전트 평가에 주는 의미"
      >
        <Prose>
          <P
            en="Taken together, our findings suggest that the behavior of LLM-based cybersecurity agents should be examined along three distinct dimensions."
            ko="이번 연구를 통해 우리는 LLM 기반 사이버보안 에이전트의 행동을 세 가지 측면에서 구분할 필요가 있다는 사실을 확인했습니다."
          />
          <Dimensions />
          <P
            en="These distinctions matter because two agents with identical overall success rates may behave very differently. One might explore many attack categories, while another repeatedly focuses on a narrow set. An agent might also have strong capabilities in a particular category but rarely choose to use them."
            ko="이 세 가지를 구분해야 하는 이유는 명확합니다. 최종 성공률이 동일한 에이전트라도 하나는 여러 공격 방법을 폭넓게 탐색하고, 다른 하나는 소수의 공격만 반복할 수 있습니다. 또한 특정 공격에 뛰어난 능력이 있더라도 실제로는 해당 공격을 거의 선택하지 않을 수 있습니다."
          />
          <P
            en="For organizations adopting AI agents for automated security assessments, such differences can have practical consequences. Selecting an agent based only on vulnerability discovery rates may overlook whether it consistently neglects certain types of vulnerabilities, repeatedly pursues ineffective strategies, or struggles to follow instructions that conflict with its usual behavior."
            ko="이러한 차이는 실제 AI 에이전트를 도입하고 운영하는 과정에서도 중요합니다. 예를 들어 기업이 보안 점검을 자동화하기 위해 에이전트를 선정한다면 단순한 취약점 발견률뿐 아니라, 어떤 유형의 취약점을 주로 탐색하는지, 특정 영역을 지나치게 회피하거나 반복하지는 않는지, 명시적인 지시가 실제 행동에 얼마나 반영되는지를 함께 살펴볼 필요가 있습니다."
          />
          <P
            en="CyBiasBench provides a way to examine these characteristics quantitatively. By measuring attack-selection diversity and concentration, category-specific success rates, token efficiency, robustness to prompting variations, and instruction compliance, it reveals behavioral differences that cannot be captured by a single performance score."
            ko="CyBiasBench는 이러한 행동 특성을 정량적으로 분석할 수 있는 평가 체계를 제공합니다. 공격 선택의 다양성과 집중도, 계열별 성공률, 토큰 효율성, 프롬프트 변화에 대한 안정성, 명시적 지시에 대한 순응도를 각각 측정함으로써 단일 성공률만으로는 드러나지 않는 차이를 확인할 수 있습니다."
          />
          <P
            en="There are, of course, limitations. Our experiments covered five specific agent versions and three web application environments. The observed attack-selection patterns were influenced not only by agent behavior but also by the available vulnerabilities and the difficulty of exploiting them. The findings should therefore not be generalized to all LLM agents or treated as evidence of immutable model preferences."
            ko="물론 이번 결과에는 한계가 있습니다. 분석은 다섯 가지 에이전트 버전과 세 가지 웹 애플리케이션 환경에 기반하며, 에이전트가 선택한 공격에는 각 표적의 취약점 구성과 난이도가 영향을 줍니다. 따라서 이를 모든 LLM 에이전트에 일반화하거나, 특정 모델의 고정된 내재적 성향으로 해석하기는 어렵습니다."
          />
          <P
            en="Nevertheless, the results highlight a broader lesson for agent evaluation:"
            ko="그럼에도 이번 연구는 AI 에이전트 평가에서 중요한 관점을 제시합니다."
          />
          <Pull
            en="To understand how well an AI agent performs, we need to examine not only what it can do, but also what it actually chooses to do."
            ko="AI 에이전트가 얼마나 잘하는지 이해하려면, 무엇을 할 수 있는지만이 아니라 실제로 무엇을 선택하는지도 살펴봐야 합니다."
          />
          <P
            en="As AI agents take on increasingly autonomous roles, understanding these choices will become even more important. We hope CyBiasBench contributes to evaluation methods that look beyond final outcomes and examine the decision-making processes that produce them."
            ko="특히 AI 에이전트가 점점 더 자율적으로 의사결정을 내리는 환경에서는 이러한 차이가 더욱 중요해질 것입니다. CyBiasBench가 앞으로의 AI 에이전트 평가가 최종 결과뿐 아니라 그 결과에 도달하는 행동 과정까지 다루는 데 기여하기를 기대합니다."
          />
        </Prose>
      </Chapter>
    </>
  );
}

/** The three evaluation dimensions from §6, laid out as a numbered list. */
function Dimensions() {
  const items = [
    {
      en: { name: "Strategy selection", body: "which attack techniques an agent chooses and how it distributes its effort across them." },
      ko: { name: "전략 선택(Strategy Selection)", body: "에이전트가 여러 공격 방법 중 무엇을 선택하고, 각 방법에 얼마나 많은 자원을 배분하는지를 의미합니다." },
    },
    {
      en: { name: "Attack performance", body: "how successfully the agent executes those techniques. Frequently choosing an attack does not necessarily mean performing it well." },
      ko: { name: "공격 성능(Attack Performance)", body: "선택한 공격이 실제로 얼마나 성공하는지를 나타냅니다. 특정 공격을 자주 시도하는 것과 그 공격을 잘 수행하는 것은 같지 않습니다." },
    },
    {
      en: { name: "Bias momentum", body: "how an agent's existing allocation patterns relate to its behavior when explicit instructions are introduced." },
      ko: { name: "편향 관성(Bias Momentum)", body: "자유 선택 상황에서 나타난 행동 패턴이 사용자의 명시적인 지시와 어떤 관계를 갖는지를 설명합니다." },
    },
  ];
  return (
    <ol className="my-2 grid gap-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <span className="font-mono text-sm text-muted-foreground pt-0.5">{i + 1}</span>
          <P
            className="!leading-[1.75]"
            en={<><strong>{it.en.name}</strong>: {it.en.body}</>}
            ko={<><strong>{it.ko.name}</strong>: {it.ko.body}</>}
          />
        </li>
      ))}
    </ol>
  );
}
