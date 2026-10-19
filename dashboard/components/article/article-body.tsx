"use client";

import type { PaperSummary } from "@/lib/types";
import { FadeIn } from "@/components/fade-in";
import { useT } from "@/lib/i18n";
import { RESEARCHERS, PAPER, REPO } from "@/lib/config";
import { CHAPTERS } from "./chapters";
import { COLUMN, Chapter, Figure, P, Prose, Pull } from "./prose";
import { L1Identification, L1Signatures } from "@/components/sections/layer1-observation";
import {
  L2EffectSize,
  L2EntropyScatter,
  L2Temporal,
} from "@/components/sections/layer2-decoupling";
import { L3Compliance, L3ObsInj, L3Transfer } from "@/components/sections/layer3-injection";

/** Chapter wrapper that pulls its number and title from CHAPTERS. */
function Ch({ n, children }: { n: number; children: React.ReactNode }) {
  const c = CHAPTERS[n - 1];
  return (
    <Chapter id={c.id} num={n} en={c.label} ko={c.labelKo}>
      {children}
    </Chapter>
  );
}

/** Opening paragraphs, shown right below the lead radar / table. */
export function ArticleIntro() {
  return (
    <Prose className="pt-10 sm:pt-12">
      <P
        en="LLM-powered AI agents have evolved from answering questions to using tools, planning multi-step tasks, and carrying out complex workflows. In cybersecurity, they can now explore web applications, identify vulnerabilities, select attack techniques, and verify whether their attempts succeed."
        ko="최근 LLM 기반 AI 에이전트는 스스로 도구를 사용하고 복잡한 작업을 수행할 수 있을 만큼 발전했습니다. 사이버보안 분야에서도 AI 에이전트가 웹 애플리케이션의 취약점을 탐색하고, 공격 방법을 선택하며, 그 결과까지 검증하는 일이 가능해졌습니다."
      />
      <P
        en="But what happens when different AI agents are asked to assess the same system? Do they approach the task in similar ways?"
        ko="그렇다면 서로 다른 AI 에이전트에게 같은 시스템을 점검하도록 맡기면 비슷한 방법을 선택할까요?"
      />
      <P
        en="One agent might begin with SQL injection, while another focuses on authentication bypass or information disclosure. These differences could be random, but they might also reflect consistent patterns in how agents make decisions."
        ko="어떤 에이전트는 SQL 인젝션부터 시도하고, 다른 에이전트는 인증 우회나 정보 노출 가능성을 먼저 살펴볼 수 있습니다. 이러한 차이는 단순한 우연일 수도 있지만, 에이전트마다 반복적으로 나타나는 행동 특성일 수도 있습니다."
      />
      <P
        en="Most existing benchmarks focus on outcomes, such as attack success rates or the number of vulnerabilities discovered. Yet agents with similar overall performance may take very different approaches. More importantly, the attacks they choose most frequently may not be the ones they perform best."
        ko="기존 벤치마크는 주로 공격 성공률이나 취약점 발견 수에 집중해 왔습니다. 그러나 최종 성능이 비슷한 에이전트라도 실제 공격 과정은 크게 다를 수 있으며, 자주 선택하는 공격이 반드시 가장 잘 수행하는 공격인 것도 아닙니다."
      />
      <P
        en={<>To investigate these differences, we developed <strong>CyBiasBench</strong>, a benchmark for understanding how LLM agents select cyberattack techniques and how those choices relate to their actual performance.</>}
        ko={<>이러한 차이를 살펴보기 위해 연구실에서는 <strong>CyBiasBench</strong>를 개발했습니다. CyBiasBench는 LLM 에이전트가 어떤 공격을 선택하고, 그 선택이 실제 성능과 어떻게 연결되는지를 체계적으로 분석하는 벤치마크입니다.</>}
      />
    </Prose>
  );
}

export function ArticleChapters({ data }: { data: PaperSummary }) {
  return (
    <>
      {/* ── 01 ── */}
      <Ch n={1}>
        <Prose>
          <P
            en="We evaluated five AI agents: Claude Opus 4.5, GPT-5.2 Codex, Gemini 2.5 Pro, Kimi k2.5, and GLM 5.1. Our test environments included OWASP Juice Shop, MLflow 2.9.2 with known vulnerabilities, and Vuln Shop, a custom-built e-commerce application with a controlled vulnerability surface."
            ko="이번 연구에서는 Claude Opus 4.5, GPT-5.2 Codex, Gemini 2.5 Pro, Kimi k2.5, GLM 5.1 등 다섯 가지 AI 에이전트를 평가했습니다. 실험에는 OWASP Juice Shop, 알려진 취약점이 존재하는 MLflow 2.9.2, 그리고 취약점 구성을 통제하기 위해 자체 개발한 Vuln Shop을 사용했습니다."
          />
          <P
            en="All agents used identical Kali Linux-based tools and ran in isolated Docker environments to ensure consistent testing conditions. Rather than relying on their self-reported results, we analyzed actual HTTP requests and responses to identify attack behavior and verify success."
            ko="에이전트마다 동일한 Kali Linux 기반 도구를 제공하고, 독립된 Docker 환경에서 실행해 실험 조건을 일관되게 유지했습니다. 또한 에이전트가 스스로 보고한 결과가 아닌 실제 HTTP 요청과 응답을 분석해 공격 행동과 성공 여부를 확인했습니다."
          />
          <P
            en={<>The evaluation consisted of two stages. First, agents were allowed to choose their own attack techniques. We then examined their behavior when explicitly instructed to focus on a particular attack category. Across four prompting conditions, we analyzed <strong>630 sessions in total</strong>, including 180 free-choice sessions and 450 targeted-instruction sessions.</>}
            ko={<>실험은 에이전트가 자유롭게 공격을 선택하는 단계와 특정 공격 계열을 명시적으로 지정하는 단계로 나누어 진행했습니다. 네 가지 프롬프트 조건을 포함해 자유 선택 세션 180회와 공격 계열 지정 세션 450회, 총 <strong>630회의 세션</strong>을 분석했습니다.</>}
          />
          <EnOnly en="The results revealed clear differences in how agents selected their attacks." />
          <P
            en="Claude and Codex most frequently chose information disclosure, allocating 25.3% and 31.5% of their attempts to this category, respectively. Gemini and Kimi favored SQL injection, while GLM showed a stronger tendency toward authentication bypass."
            ko="그 결과, 같은 환경에서도 에이전트마다 공격을 선택하는 방식이 뚜렷하게 달랐습니다. Claude와 Codex는 정보 노출(Information Disclosure)을 가장 자주 선택했으며, 그 비중은 각각 25.3%와 31.5%였습니다. 반면 Gemini와 Kimi는 SQL 인젝션을, GLM은 인증 우회를 상대적으로 많이 시도했습니다."
          />
          <P
            en="Agents also differed in how broadly they explored attack techniques. Claude attempted an average of 7.8 distinct attack categories per session, compared with just 3.1 for Gemini. Some agents explored a wide range of possibilities, while others concentrated on a smaller set of techniques."
            ko="공격을 탐색하는 범위에서도 차이가 나타났습니다. Claude는 세션당 평균 7.8개의 공격 계열을 시도한 반면, Gemini는 평균 3.1개 계열에 집중했습니다. 어떤 에이전트는 여러 공격 가능성을 폭넓게 탐색하고, 다른 에이전트는 특정 유형에 자원을 집중하는 것입니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L1Signatures data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="These differences were statistically significant (Kruskal–Wallis, p = 3.64 × 10⁻¹⁶, η² = 0.426). More interestingly, the patterns remained relatively stable across prompting conditions. A classifier trained using only attack-category selection proportions identified the agent with 65% accuracy, compared with a 20% random baseline."
            ko="이러한 차이는 통계적으로도 유의했습니다(Kruskal–Wallis, p = 3.64 × 10⁻¹⁶, η² = 0.426). 특히 프롬프트 조건을 변경해도 선택 패턴이 비교적 안정적으로 유지됐으며, 공격 계열별 선택 비중만으로 에이전트를 식별하는 분류기는 65%의 정확도를 기록했습니다. 무작위 기준선이 20%라는 점을 고려하면, 공격 선택 패턴이 에이전트별 행동 특성을 상당 부분 반영하고 있음을 알 수 있습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L1Identification data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="This suggests that attack-selection patterns capture distinctive characteristics of agent behavior. However, they should not be interpreted as fixed internal preferences. Attack choices are also influenced by vulnerability availability, discoverability, and exploitation difficulty."
            ko={<>다만 이를 모델의 고정된 성향으로 해석하기는 어렵습니다. 실제 공격 선택에는 표적 시스템의 취약점 구성, 발견 가능성, 실행 난이도도 영향을 주기 때문입니다. 그럼에도 <strong>같은 과제를 수행하는 AI 에이전트들이 서로 다른 공격 선택 패턴을 보이며, 이러한 차이가 반복적으로 관찰된다</strong>는 점은 주목할 만합니다.</>}
          />
          <EnOnly
            en={<>Even with these factors in mind, the findings show that <strong>different agents exhibit distinguishable and relatively consistent attack-selection patterns when performing the same tasks</strong>.</>}
          />
        </Prose>
      </Ch>

      {/* ── 02 ── */}
      <Ch n={2}>
        <Prose>
          <P
            en="After identifying differences in attack selection, we examined whether agents tended to favor the techniques they performed best."
            ko="에이전트마다 공격 선택 패턴이 다르다는 사실을 확인한 뒤, 우리는 이러한 선택이 실제 공격 성능과 얼마나 일치하는지 살펴봤습니다. 일반적으로 에이전트가 효과적인 공격 방법에 더 많은 자원을 배분할 것으로 기대할 수 있지만, 실험 결과는 그렇지 않았습니다."
          />
          <EnOnly en="One might expect an agent to devote more effort to attacks with higher chances of success. Our results, however, revealed a different pattern." />
          <P
            en="Codex allocated 31.5% of its attempts to information disclosure, despite achieving only a 22.1% success rate in that category. Meanwhile, it achieved a 100% success rate on file-upload attacks without selecting them most frequently. Claude showed a similar mismatch: although information disclosure was its most frequently attempted category, its success rate was higher for insecure direct object reference (IDOR) attacks. We observed a comparable pattern with Gemini."
            ko="Codex는 전체 공격 시도의 31.5%를 정보 노출에 사용했지만, 해당 계열의 성공률은 22.1%에 그쳤습니다. 반면 파일 업로드 공격에서는 100%의 성공률을 기록했음에도 이를 가장 자주 선택하지는 않았습니다. Claude 역시 정보 노출을 가장 많이 시도했지만, 실제 성공률은 IDOR 공격에서 더 높았습니다. Gemini에서도 비슷한 차이가 나타났습니다."
          />
          <P
            en={<>In other words, <strong>the techniques agents choose most often are not necessarily the techniques they execute most successfully</strong>.</>}
            ko={<>이는 <strong>에이전트가 선호하는 공격과 실제로 높은 성과를 내는 공격이 반드시 일치하지 않는다</strong>는 것을 보여줍니다.</>}
          />
          <P
            en="This difference was also evident in our statistical analysis. Attack-selection entropy showed a large effect size across agents (η² = 0.426), while the effect size for overall session attack success rate (ASR) was much smaller (η² = 0.047). Agents differed far more in how they distributed their efforts than in their final success rates."
            ko="흥미롭게도 이러한 차이는 에이전트 간 성능 비교에서도 확인됐습니다. 공격 선택의 다양성을 나타내는 엔트로피의 효과크기는 η² = 0.426으로 크게 나타났지만, 전체 세션 공격 성공률(ASR)의 효과크기는 η² = 0.047에 그쳤습니다. 즉, 에이전트 사이의 차이는 최종 성공률보다 공격을 선택하는 방식에서 훨씬 뚜렷했습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L2EffectSize data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="We also examined whether exploring more attack categories improved performance. Only Codex showed a statistically significant positive correlation between session entropy and ASR (ρ = 0.426, p = 0.010), while the other four agents showed no significant relationship."
            ko="다양한 공격을 시도하는 것이 더 높은 성공률로 이어지는지도 분석했습니다. 그 결과 Codex에서만 유의한 양의 상관이 관찰됐으며(ρ = 0.426, p = 0.010), 나머지 네 에이전트에서는 유의한 관계가 나타나지 않았습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L2EntropyScatter data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en={<>These findings suggest that broader exploration does not necessarily lead to better outcomes. Evaluating AI agents therefore requires distinguishing <strong>what they choose to do from how well they perform those actions</strong>.</>}
            ko={<>결국 공격을 폭넓게 탐색한다고 해서 반드시 더 좋은 결과를 얻는 것은 아닙니다. AI 에이전트를 평가할 때는 <strong>어떤 공격을 선택하는지와 선택한 공격을 얼마나 잘 수행하는지</strong>를 구분해 살펴볼 필요가 있습니다.</>}
          />
        </Prose>
      </Ch>

      {/* ── 03 ── */}
      <Ch n={3}>
        <Prose>
          <P
            en="Another important question is how agents respond when their attacks fail."
            ko="에이전트가 공격에 실패했을 때 어떻게 행동하는지도 중요한 평가 요소입니다. 일반적으로 보안 전문가는 특정 공격이 반복해서 실패하면 다른 취약점이나 접근 방법을 검토합니다. AI 에이전트도 같은 방식으로 전략을 조정하는지 확인했습니다."
          />
          <P
            en="A human security analyst might reconsider their approach after repeated failures and explore different vulnerabilities. We examined whether AI agents showed a similar tendency by comparing how often they switched attack categories after successful and unsuccessful attempts."
            ko="이를 위해 공격 성공 이후와 실패 이후에 다른 공격 계열로 전환하는 비율을 비교했습니다. 그러나 실패 후 전환 비율은 성공 후 전환 비율과 비슷한 수준이었으며, 실패를 경험했다고 해서 더 적극적으로 전략을 바꾸는 경향은 나타나지 않았습니다."
          />
          <EnOnly en="Surprisingly, switching rates after failure were similar to those after success. Agents did not consistently become more likely to change their approach simply because an attack had failed." />
        </Prose>
        {data.temporal_adaptation && data.temporal_adaptation.length > 0 && (
          <Figure>
            <FadeIn><L2Temporal data={data} /></FadeIn>
          </Figure>
        )}
        <Prose>
          <P
            en="This observation helps explain the gap between selection and performance. An agent may repeatedly attempt a relatively ineffective technique without necessarily shifting toward a more promising alternative."
            ko="이러한 결과는 앞서 확인한 공격 선택과 성능의 불일치를 이해하는 데 도움이 됩니다. 에이전트가 특정 공격을 반복적으로 시도하더라도, 실패 경험이 반드시 더 효과적인 공격 계열로의 전환으로 이어지지는 않는다는 것입니다."
          />
          <P
            en={<>For autonomous security agents, this highlights the importance of evaluating not only their ability to execute attacks, but also <strong>how effectively they use feedback from unsuccessful attempts to guide subsequent decisions</strong>.</>}
            ko={<>따라서 자율적인 보안 에이전트를 평가하거나 개발할 때는 단순한 공격 실행 능력뿐 아니라, <strong>실패 경험을 이후의 의사결정에 얼마나 효과적으로 반영하는지</strong>도 고려할 필요가 있습니다.</>}
          />
        </Prose>
      </Ch>

      {/* ── 04 ── */}
      <Ch n={4}>
        <Prose>
          <P
            en="If agents do not naturally prioritize their most successful techniques, can explicit instructions help redirect their behavior?"
            ko="그렇다면 사용자가 공격 방법을 직접 지정하면 기존의 선택 편향을 줄일 수 있을까요?"
          />
          <P
            en="To investigate this, we conducted a second experiment in which each agent was instructed to focus on one of ten attack categories, including SQL injection, cross-site scripting (XSS), and authentication bypass. The testing environment, available tools, and success-verification process remained unchanged; only the attack instructions were modified."
            ko="이를 확인하기 위해 두 번째 실험에서는 에이전트에게 SQL 인젝션, XSS, 인증 우회 등 10개 공격 계열 중 하나를 명시적으로 지정했습니다. 도구와 표적 환경, 성공 판정 방법은 동일하게 유지하고 프롬프트의 공격 지시만 변경했습니다."
          />
          <P
            en={<>We measured <strong>compliance</strong>, defined as the proportion of attempts directed toward the instructed attack category.</>}
            ko={<>여기서 주목한 것은 에이전트가 지시받은 공격을 실제로 얼마나 수행하는지를 나타내는 <strong>순응도(Compliance)</strong>입니다. 분석 결과, 순응도는 자유 선택 상황에서 해당 공격 계열을 얼마나 자주 선택했는지와 유의한 양의 상관을 보였습니다(ρ = 0.529, p = 7.73 × 10⁻⁵).</>}
          />
          <P
            en="Compliance was positively correlated with how frequently the agent had selected that category during free-choice sessions (ρ = 0.529, p = 7.73 × 10⁻⁵). In contrast, the relationship between compliance and the agent's previous success rate in that category was not statistically significant (ρ = −0.248, Bonferroni-adjusted p = 0.083)."
            ko="반면 해당 공격 계열의 기존 성공률과 순응도 사이에서는 통계적으로 유의한 관계가 나타나지 않았습니다(ρ = −0.248, Bonferroni 보정 후 p = 0.083)."
          />
        </Prose>
        <Figure>
          <FadeIn><L3Compliance data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en={<>Put simply, <strong>agents were more responsive to instructions targeting attacks they already tended to choose than to those targeting attacks they performed well</strong>.</>}
            ko={<>즉, <strong>에이전트는 원래 잘하던 공격보다 평소 자주 선택하던 공격에 대한 지시를 더 잘 따르는 경향</strong>을 보였습니다.</>}
          />
          <P
            en={<>We call this relationship <strong>bias momentum</strong>, describing how an agent&apos;s existing attack-allocation patterns remain associated with its behavior under explicit instructions.</>}
            ko={<>우리는 자유 선택 상황에서 나타난 자원 배분이 명시적인 지시 상황의 행동과 연결되는 이러한 현상을 <strong>편향 관성(Bias Momentum)</strong>이라고 정의했습니다.</>}
          />
          <P
            en="Importantly, bias momentum does not establish a fixed internal preference or a causal mechanism. It describes a behavioral relationship observed under the evaluated security-testing conditions."
            ko="다만 이 개념은 에이전트 내부에 고정된 선호가 존재한다거나, 해당 선호가 행동을 직접적으로 유발한다는 뜻은 아닙니다. 이번 연구에서는 실제 공격 환경에서 관찰된 행동상의 연관성을 설명하는 개념으로 사용했습니다."
          />
        </Prose>
      </Ch>

      {/* ── 05 ── */}
      <Ch n={5}>
        <Prose>
          <P
            en="Explicit instructions can influence which attacks an agent attempts, but do they improve the actual success rate?"
            ko="공격 계열을 직접 지정하면 에이전트가 해당 지시를 따르는 정도는 달라질 수 있습니다. 그렇다면 실제 공격 성공률도 개선될까요?"
          />
          <P
            en={<>In our experiments, <strong>instructing agents to focus on specific attack categories did not improve overall average attack success</strong>.</>}
            ko={<>실험 결과, <strong>특정 공격 계열을 명시적으로 지정하는 것만으로는 전체 평균 공격 성공률이 개선되지 않았습니다.</strong></>}
          />
          <P
            en="The equally weighted average change in session ASR across the five agents was −5.82 percentage points. Gemini's ASR decreased from 31.75% to 18.13%, while Codex dropped from 21.35% to 14.06%. Claude and GLM showed comparatively smaller changes."
            ko="다섯 에이전트의 균등 평균 ASR 변화는 −5.82%p였습니다. Gemini의 성공률은 31.75%에서 18.13%로, Codex는 21.35%에서 14.06%로 감소했으며, Claude와 GLM에서는 상대적으로 작은 변화가 나타났습니다."
          />
          <P
            en="However, the 95% confidence intervals for three individual agents included zero, so these results do not establish a consistent performance decrease across every agent."
            ko="다만 개별 에이전트 3종의 95% 신뢰구간에는 0이 포함됐으므로, 모든 에이전트에서 성능이 일관되게 감소했다고 단정할 수는 없습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L3ObsInj data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en="Compliance also showed no significant correlation with session ASR (ρ = −0.082, p = 0.573). Following an instruction more closely did not necessarily lead to better attack outcomes."
            ko="또한 지시를 얼마나 충실하게 따르는지와 실제 공격 성공률 사이에서도 유의한 상관이 나타나지 않았습니다(ρ = −0.082, p = 0.573). 이는 에이전트가 사용자의 지시에 잘 따르는 것과 실제로 높은 성능을 내는 것이 서로 다른 문제임을 보여줍니다."
          />
          <P
            en="At the same time, agents' relative strengths across attack categories remained largely consistent between experimental settings. Category-specific success rates under free-choice and targeted-instruction conditions showed a strong positive correlation (ρ = 0.702, p = 1.38 × 10⁻⁸). This relationship was statistically significant for four of the five agents, with Gemini being the exception."
            ko="반면 공격 계열별 성능 자체는 실험 조건이 바뀌어도 비교적 안정적으로 유지됐습니다. 자유 선택 조건과 공격 계열 지정 조건의 계열별 ASR 사이에는 강한 양의 상관이 나타났으며(ρ = 0.702, p = 1.38 × 10⁻⁸), 다섯 에이전트 중 네 에이전트에서 유의한 관계가 확인됐습니다. Gemini는 예외였습니다."
          />
        </Prose>
        <Figure>
          <FadeIn><L3Transfer data={data} /></FadeIn>
        </Figure>
        <Prose>
          <P
            en={<>Together, these results highlight an important distinction: <strong>redirecting an agent&apos;s behavior through prompting is not the same as improving its ability to perform a task</strong>. Simply emphasizing a particular attack technique may not produce a more effective security-testing strategy.</>}
            ko={<>결국 <strong>프롬프트를 통해 에이전트의 행동을 유도하는 것과 에이전트의 실제 공격 능력을 개선하는 것은 별개의 문제</strong>입니다. 특정 공격 방법을 강조하는 것만으로 더 효과적인 공격 전략이 만들어지지는 않았습니다.</>}
          />
        </Prose>
      </Ch>

      {/* ── 06 ── */}
      <Ch n={6}>
        <Prose>
          <P
            en="Our findings suggest that the behavior of LLM-based cybersecurity agents should be evaluated along three distinct dimensions."
            ko="CyBiasBench의 결과는 LLM 기반 사이버보안 에이전트의 행동을 세 가지 관점에서 구분해 평가할 필요가 있음을 보여줍니다."
          />
          <P
            en={<><strong>Strategy Selection</strong> describes which attack techniques an agent chooses and how it distributes its effort across them. <strong>Attack Performance</strong> measures how successfully the agent executes those techniques. <strong>Bias Momentum</strong> captures the relationship between an agent&apos;s free-choice allocation patterns and its behavior under explicit instructions.</>}
            ko={<><strong>전략 선택(Strategy Selection)</strong>은 에이전트가 어떤 공격을 선택하고 각 공격에 얼마나 많은 자원을 배분하는지를 나타냅니다. <strong>공격 성능(Attack Performance)</strong>은 선택한 공격을 실제로 얼마나 성공적으로 수행하는지를 측정합니다. 마지막으로 <strong>편향 관성(Bias Momentum)</strong>은 자유 선택 상황의 배분 패턴이 명시적인 지시를 받은 상황의 행동과 어떻게 연결되는지를 설명합니다.</>}
          />
          <P
            en="These distinctions matter because overall success rates alone provide an incomplete picture of agent behavior. Two agents may achieve similar outcomes even when one explores many attack categories and the other repeatedly focuses on a narrow set. An agent may also have strong capabilities in a particular category but rarely choose to use them."
            ko="이러한 구분이 중요한 이유는 최종 성공률만으로는 에이전트의 실제 행동을 충분히 이해하기 어렵기 때문입니다. 비슷한 성공률을 기록한 에이전트라도 하나는 다양한 공격을 시도하고, 다른 하나는 특정 공격을 반복할 수 있습니다. 또한 특정 공격을 수행할 능력이 충분하더라도 실제로는 거의 선택하지 않을 수 있습니다."
          />
          <P
            en="For organizations adopting AI agents for automated security assessments, these differences have practical implications. Beyond vulnerability discovery rates, it is important to understand which vulnerabilities an agent tends to investigate, whether it repeatedly pursues ineffective strategies or overlooks certain categories, and how reliably it follows instructions."
            ko="이 차이는 AI 에이전트를 실제 보안 업무에 도입할 때도 중요합니다. 기업이 자동화된 보안 점검을 위해 에이전트를 선정한다면 단순한 취약점 발견률뿐 아니라, 어떤 취약점을 주로 탐색하는지, 특정 공격을 지나치게 반복하거나 회피하지는 않는지, 명시적인 지시가 실제 행동에 얼마나 반영되는지를 함께 살펴볼 필요가 있습니다."
          />
          <P
            en="CyBiasBench provides a framework for examining these characteristics through separate measures of attack-selection diversity and concentration, category-specific success rates, token efficiency, prompt robustness, and instruction compliance. Together, these metrics reveal behavioral differences that a single performance score cannot capture."
            ko="CyBiasBench는 이를 위해 공격 선택의 다양성과 집중도, 계열별 성공률, 토큰 효율성, 프롬프트 변화에 대한 안정성, 지시 순응도를 구분해 측정합니다. 이를 통해 기존의 단일 성능 지표로는 드러나지 않았던 에이전트의 행동 특성을 보다 구체적으로 이해할 수 있습니다."
          />
          <P
            en="There are limitations to our findings. The study evaluated five specific agent versions across three web application environments, and attack choices were influenced by the available vulnerabilities and their difficulty. The results should therefore not be generalized to all LLM agents or treated as evidence of immutable model preferences."
            ko="물론 이번 연구는 다섯 가지 에이전트 버전과 세 가지 웹 애플리케이션을 대상으로 수행됐으며, 실제 선택 패턴에는 취약점 구성과 공격 난이도도 영향을 줍니다. 따라서 모든 AI 에이전트에 동일한 경향이 나타난다고 일반화하거나, 관찰된 행동을 모델의 고정된 내재적 선호로 해석하는 데에는 주의가 필요합니다."
          />
          <P
            en="Nevertheless, the findings point to a broader lesson for AI agent evaluation."
            ko="그럼에도 이번 연구가 보여주는 방향은 분명합니다."
          />
          <Pull
            en="Understanding an AI agent requires looking beyond what it can do to examine what it actually chooses to do, and how those choices shape its performance."
            ko="AI 에이전트를 제대로 평가하려면 무엇을 할 수 있는지만이 아니라, 실제로 무엇을 선택하고 그 선택을 어떻게 실행하는지도 살펴봐야 합니다."
          />
          <P
            en="As AI agents take on increasingly autonomous roles, evaluating their decision-making behavior will become just as important as measuring their final outcomes. We hope CyBiasBench helps advance evaluation methods that capture both."
            ko="AI 에이전트가 점점 더 자율적으로 의사결정을 수행하는 환경에서 이러한 행동 중심 평가는 더욱 중요해질 것입니다. CyBiasBench가 결과 중심의 평가를 넘어, AI 에이전트의 의사결정 과정까지 이해하는 데 기여하기를 기대합니다."
          />
        </Prose>
      </Ch>
    </>
  );
}

/**
 * A paragraph that exists only in the English text (the Korean text merges
 * that sentence into a neighbouring paragraph), so nothing renders in Korean.
 */
function EnOnly({ en }: { en: React.ReactNode }) {
  const t = useT();
  return t(<P en={en} ko={null} />, null);
}

/** Closing citation block (from the English text). */
export function ArticleEndMatter() {
  const t = useT();
  return (
    <section className={`${COLUMN} pt-16`}>
      <div className="border-t border-border pt-8 space-y-2 text-sm text-muted-foreground">
        <p className="text-base font-semibold text-foreground">
          CyBiasBench — Benchmarking Bias in LLM Agents for Cyber-Attack Scenarios
        </p>
        <p>NeurIPS 2026 Evaluations &amp; Datasets Track</p>
        <p>
          <span className="font-semibold text-foreground/80">{t("Authors", "저자")}:</span>{" "}
          {RESEARCHERS.map((r, i) => (
            <span key={r.name}>
              {r.name}
              {r.equal && "*"}
              {r.corresponding && "†"}
              {i < RESEARCHERS.length - 1 && ", "}
            </span>
          ))}
        </p>
        <p className="text-xs">
          {t("* Equal Contribution · † Corresponding Authors", "* 동등 기여 · † 교신저자")}
        </p>
        {(PAPER.href || REPO.url) && (
          <p className="flex flex-wrap gap-x-2">
            {PAPER.href && (
              <a href={PAPER.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {PAPER.label}
              </a>
            )}
            {PAPER.href && REPO.url && <span aria-hidden>·</span>}
            {REPO.url && (
              <a href={REPO.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {REPO.label}
              </a>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
