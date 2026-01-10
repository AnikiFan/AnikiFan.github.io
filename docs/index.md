---
title: Homepage
template: home.html
---

<!-- 顶部个人信息：头像 + 名片式简介 -->
<div class="profile" style="display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap;">
  <img src="assets/images/avatar.jpg" alt="Your Avatar" width="120" height="120" style="border-radius:50%; box-shadow: 0 4px 16px rgba(0,0,0,.12);" />
  <div>
    <h1 style="margin:0 0 .25rem 0;">Xiao Fan (范潇)</h1>
    <p style="margin:.25rem 0 0 0;">Senior student @ Tongji University<br>Interests: Test-time Adaptation, Self-Evolving Embodied Agent</p>
    <p style="margin:.25rem 0 0 0;">
      <a href="mailto:xiaofan140@gmail.com">xiaofan140@gmail.com</a> ·
      <a href="https://scholar.google.com/citations?user=XeFBXxYAAAAJ&hl=en" target="_blank" rel="noopener">Google Scholar</a> ·
      <a href="https://github.com/AnikiFan" target="_blank" rel="noopener">GitHub</a> ·
      <a href="assets/images/WeChat.png" target="_blank" rel="noopener">WeChat</a> · 
      <a href="assets/cv/cv.pdf" target="_blank" rel="noopener">CV</a>
    </p>
  </div>
</div>

---

## Education

| Degree | Institution | Advisor | Years |
|---|---|---|---|
| B.Eng. in Data Science | Tongji University |  | 2022–2026 |
| D.Eng in Electronic Information | Tsinghua University | [Prof. Zhi Wang](http://pages.mmlab.top/) | 2026–2031 |
<!-- | M.S. in XXX | Another University |  | 2019–2022 | --> 

---

!!! note "Recent News"
    - **[2025-09]** My personal website is launched!
    - **[2025-09]** We have released a new paper [VERL](https://hf618.github.io/VERL.github.io/) on Reinforcement Learning for reasoning LLM.
    - **[2025-11]** {==My first paper is accepted by AAAI 2026 (CCF-A, 17.6% overall acceptance rate)!==}
---

## Publications

> *\* equal contribution, † corresponding author.*

### 2025

!!! info ""
    ![VERL](assets/images/paper/2025/VERL.png){ align=left width=50%}
    **Beyond the Exploration-Exploitation Trade-off: A Hidden State Approach for LLM Reasoning in RLVR**  
    {{ author("huang_fan_ding") }}<sup>\*</sup>, {{ author("huang_guan_bo") }}<sup>\*</sup>, **Xiao Fan**, {{ author("he_yi") }}, {{ author("liang_xiao") }}, {{ author("chen_xiao") }}, {{ author("jiang_qin_ting") }}, {{ author("faisal_nadeem_khan") }}, {{ author("jiang_jing_yan") }}<sup>†</sup>, {{ author("wang_zhi") }}<sup>†</sup>.  
    *Submitted to ACL ARR 2026.*  
    [[Paper]](https://arxiv.org/abs/2509.23808) [[Code]](https://github.com/hf618/VERL) [[Project]](https://hf618.github.io/VERL.github.io/) [[BibTex]](https://dblp.org/rec/journals/corr/abs-2509-23808.bib?param=1)

    <div style="clear: both; height: 0; margin: 0; padding: 0;"></div>
    ??? abstract
        A prevailing view in Reinforcement Learning with Verifiable Rewards (RLVR) interprets recent progress through the lens of an exploration-exploitation trade-off, a perspective largely shaped by token-level metrics. We re-examine this perspective, proposing that this perceived trade-off may not be a fundamental constraint but rather an artifact of the measurement level. To investigate this, we shift the analysis to the semantically rich hidden-state space, adopting Effective Rank (ER) to quantify exploration and proposing its novel first- and second-order derivatives, named ER Velocity and ER Acceleration, to capture exploitation dynamics. Our analysis reveals that in the semantic space, exploration and exploitation could be decoupled (Sec.4). This finding reveals an opportunity to enhance both capacities simultaneously. This insight motivates our method, Velocity-Exploiting Rank-Learning (VERL), the first to operationalize the principle of synergistic exploration-exploitation enhancement by directly shaping the RL advantage function. The key innovation is leveraging the theoretically stable ERA as a predictive meta-controller to create a synergistic, dual-channel incentive structure. Instead of forcing a trade-off, VERL prospectively amplifies rewards for exploration to preempt overconfidence and reinforces exploitative gains to consolidate reasoning. Experiments across diverse LLMs and reasoning benchmarks show consistent gains, including up to 21.4% absolute accuracy improvement on the challenging Gaokao 2024 dataset.

### 2026

!!! info ""
    ![MoETTA](assets/images/paper/2026/AAAI_MoETTA.png){ align=left width=50%}

    **MoETTA: Test-Time Adaptation Under Mixed Distribution Shifts with MoE-LayerNorm**  
    **Xiao Fan**, {{ author("jiang_jing_yan") }}<sup>†</sup>, {{ author("chen_zhao_ru") }}, {{ author("huang_fan_ding") }}, {{ author("chen_xiao") }}, {{ author("jiang_qin_ting")}}, {{ author("zhang_bo_wen") }}, {{ author("tang_xing") }}, {{ author("wang_zhi") }}.  
    {==*Accepted by AAAI 2026 (CCF-A, 17.6% overall acceptance rate).*==}  
    [[Paper]](https://arxiv.org/abs/2511.13760v1) [[Code]](https://github.com/AnikiFan/MoETTA) <!--[[project]](https://yourdomain.example/project-a)--> [[BibTex]](https://scholar.googleusercontent.com/scholar.bib?q=info:MhQkAYKtitAJ:scholar.google.com/&output=citation&scisdr=Cryq5hPsEPeRgJlUapk:ALhkC2QAAAAAaV9ScpkdxvXTz94sELchgtXbXfI&scisig=ALhkC2QAAAAAaV9ScqsfHsiwOF_8KIaL6i4uz1Q&scisf=4&ct=citation&cd=-1&hl=en)

    <div style="clear: both; height: 0; margin: 0; padding: 0;"></div>
    ??? abstract
        Test-Time Adaptation (TTA) has proven effective in mitigating performance drops under single-domain distribution shifts by updating model parameters during inference. However, real-world deployments often involve mixed distribution shifts, where test samples are affected by diverse and potentially conflicting domain factors, posing significant challenges even for state-of-the-art TTA methods. A key limitation in existing approaches is their reliance on a unified adaptation path, which fails to account for the fact that optimal gradient directions can vary significantly across different domains. Moreover, current benchmarks focus only on synthetic or homogeneous shifts, failing to capture the complexity of real-world heterogeneous mixed distribution shifts.
        To address this, we propose **MoETTA**, a novel entropy-based TTA framework that integrates the Mixture-of-Experts (MoE) architecture. Rather than enforcing a single parameter update rule for all test samples, MoETTA introduces a set of structurally decoupled experts, enabling adaptation along diverse gradient directions. This design allows the model to better accommodate heterogeneous shifts through flexible and disentangled parameter updates.
        To simulate realistic deployment conditions, we introduce two new benchmarks: *potpourri* and *potpourri+*. While classical settings focus solely on synthetic corruptions (i.e., ImageNet-C), potpourri encompasses a broader range of domain shifts—including natural, artistic, and adversarial distortions—capturing more realistic deployment challenges. Additionally, potpourri+ further includes source-domain samples to evaluate robustness against catastrophic forgetting.
        Extensive experiments across three mixed distribution shifts settings show that MoETTA consistently outperforms strong baselines, establishing new state-of-the-art performance and highlighting the benefit of modeling multiple adaptation directions via expert-level diversity.

<!-- TODO: use bibtex exported from dblp!!! -->
<!-- TODO: change project url!!! -->

<!--
2. **Paper Title B**  
   Your Name, Collaborator C†.  
   *Journal 2025.* [[paper]](https://doi.org/xxx) -->

---

## Projects

- **I promise I will soon organize and share my past projects.**

---

## Service

- **Sadly, nothing to serve yet.**

<div id="map-container">
    </div>

<script>
  function loadMap(scheme) {
    const container = document.getElementById('map-container');
    
    // 1. 清空当前容器（防止切换模式时出现多个地图）
    container.innerHTML = '';

    // 2. 创建新的 script 标签
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'mapmyvisitors';

    // 3. 根据模式设置不同的 src
    if (scheme === 'slate') {
      // 暗色模式的配置 (注意这里的参数，如 cl, co, ct 等可以自定义为深色系)
      script.src = 'https://mapmyvisitors.com/map.js?cl=ffffff&w=a&t=tt&d=AW6RVWNwzLEyhknDhkn3Cr9N0KYuZO-ObNBbBJjnQz4&co=1e2129&ct=ffffff&cmo=5ddfef&cmn=d354b9';
    } else {
      // 亮色模式的配置 (你可以修改参数以适应浅色背景)
      script.src = 'https://mapmyvisitors.com/map.js?cl=4051b5&w=a&t=tt&d=AW6RVWNwzLEyhknDhkn3Cr9N0KYuZO-ObNBbBJjnQz4&co=ffffff&ct=4051b5&cmo=5ddfef&cmn=d354b9';
    }

    // 4. 将脚本注入容器
    container.appendChild(script);
  }

  // --- 主题监听逻辑 ---

  // 初始加载
  window.addEventListener('load', function() {
    const initialScheme = document.body.getAttribute("data-md-color-scheme");
    loadMap(initialScheme);

    // 监听主题切换
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === "data-md-color-scheme") {
          const newScheme = document.body.getAttribute("data-md-color-scheme");
          loadMap(newScheme);
        }
      });
    });

    observer.observe(document.body, { attributes: true });
  });
</script>