import fs from 'fs/promises';
import path from 'path';
import { log } from './logger';

/**
 * Starter skills bundled with Pilot. On first launch they are seeded into the
 * global skills directory (~/.pilot/skills/<name>/SKILL.md) so they behave
 * exactly like user-authored skills afterwards: editable in Settings, listed
 * in the supervisor's catalog, and deletable — a bumped SEED_VERSION only adds
 * skills that don't already exist, it never resurrects deleted ones or
 * overwrites edits.
 */
const SEED_VERSION = 1;
const SEED_MARKER = '.builtin-seeded';

interface BuiltinSkill {
  name: string;
  content: string;
}

const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    name: 'office-cli',
    content: `# Office 文档命令行生成(docx / xlsx / pptx / pdf)

## 适用场景
用户要求产出 Word、Excel、PPT 或 PDF 文件时使用(报告、表格、幻灯片、导出文档)。

## 工具优先级
1. **pandoc** — Markdown → docx / pptx / pdf 的最快路径,适合以文字为主的文档
2. **python-docx / openpyxl / python-pptx** — 需要精细控制(样式、表格、图表、模板)时用 Python 脚本生成
3. **soffice --headless --convert-to pdf** — 现有文档的格式转换与最终 PDF 输出

## 步骤
1. 先确认目标格式、受众和大致篇幅(不确定就用 ask_user 问)
2. 检查依赖再动手:\`which pandoc\`、\`python3 -c "import docx"\` 等;缺失时先安装(如 \`pip3 install --user python-docx openpyxl python-pptx\`)
3. 先产出 Markdown / 数据草稿让用户确认结构,再生成最终文件
4. 生成文件统一放到项目的 \`output/\` 目录,完成后报告文件的绝对路径
5. 验证产物:文件存在且非空;docx/pptx 可用 \`soffice --headless --convert-to pdf\` 抽查能否正常打开

## 约定
- 中文内容注意字体兼容(优先常见系统字体,避免生成后乱码)
- 生成命令和脚本的执行委派给子代理;结构与内容决策留在对话中确认
`,
  },
  {
    name: 'web-research',
    content: `# 网络调研:搜索、抓取与汇总

## 适用场景
用户要求查资料、对比方案、了解某个技术或产品的最新状况时使用。

## 步骤
1. 单个已知 URL / API:直接用 \`web_fetch\` 读取,不必委派
2. 需要搜索或浏览多个页面:委派给子代理(它们自带完整的 web 工具),任务里写清检索词和想要回答的问题
3. 汇总输出:要点列表 + 每个要点标注来源 URL

## 约定
- 绝不编造链接或数据;拿不到来源就明说
- 时效敏感的信息(版本号、价格、政策)注明查询日期
`,
  },
  {
    name: 'code-review',
    content: `# 代码审查清单

## 适用场景
用户要求审查代码、检查 PR 或诊断某个模块的质量时使用。

## 审查维度(按严重度排序)
1. 正确性:逻辑错误、边界条件、空值处理
2. 并发与资源:竞态、泄漏、未清理的监听器/定时器
3. 错误处理:吞掉的异常、缺失的失败路径
4. 测试缺口:关键路径有没有测试覆盖
5. 可维护性:重复代码、过深嵌套、命名误导

## 输出格式
每条问题一行:\`严重度 | 文件:行号 | 一句话问题 | 修复建议\`,按严重度从高到低排列;没有问题也要明确说检查了哪些方面。

## 约定
- 大范围审查拆成模块,可并行委派给多个子代理
- 只报告有证据的问题,不猜测;不确定的标注"待确认"
`,
  },
];

let seedPromise: Promise<void> | null = null;

/** Seed bundled skills into ~/.pilot/skills once per SEED_VERSION. Idempotent. */
export function seedBuiltinSkills(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed(): Promise<void> {
  try {
    const globalDir = path.join(process.env.HOME || '', '.pilot', 'skills');
    await fs.mkdir(globalDir, { recursive: true });

    const markerPath = path.join(globalDir, SEED_MARKER);
    let seededVersion = 0;
    try {
      seededVersion = parseInt(await fs.readFile(markerPath, 'utf-8'), 10) || 0;
    } catch { /* not seeded yet */ }
    if (seededVersion >= SEED_VERSION) return;

    let added = 0;
    for (const skill of BUILTIN_SKILLS) {
      const dir = path.join(globalDir, skill.name);
      try {
        await fs.access(dir);
        continue; // exists (user-owned by now) — never overwrite
      } catch { /* missing — seed it */ }
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), skill.content, 'utf-8');
      added++;
    }
    await fs.writeFile(markerPath, String(SEED_VERSION), 'utf-8');
    log('builtin-skills', `Seeded ${added} builtin skill(s) (version ${SEED_VERSION})`);
  } catch (err) {
    log('builtin-skills', `Seeding failed: ${err}`);
  }
}
