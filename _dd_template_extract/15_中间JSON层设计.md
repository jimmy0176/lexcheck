# 中间 JSON 层设计

## 一、目的

在“原始资料 → AI生成段落 → 人工审核 → 汇总成完整报告”的流程中，建议增加一层统一的 JSON 结构。

作用：
1. 先让 AI 输出结构化字段，减少直接生成长文本时的跑偏
2. 方便人工审核和修改
3. 方便二次渲染为 Markdown / Word / 网页
4. 方便后续复用同一套字段生成不同版本报告

---

## 二、推荐流程

1. 上传多份资料
2. 按章节调用 AI
3. AI 先输出对应 section 的 JSON
4. 页面展示 JSON 字段，人工审核和修改
5. 根据审核后的 JSON 渲染为各章节 Markdown
6. 汇总为完整报告

---

## 三、总 JSON 外层结构示例

```json
{
  "project_name": "专项法律、财务尽职调查报告",
  "company_name": "浙江新祥铝业股份有限公司",
  "report_date": "2026-01-08",
  "sections": {
    "section_01": {},
    "section_02": {},
    "section_03": {},
    "section_04": {},
    "section_05": {},
    "section_06": {},
    "section_07": {},
    "section_08": {},
    "section_09": {},
    "section_10": {},
    "section_11": {},
    "section_12": {},
    "section_13": {},
    "section_14": {}
  }
}
```

---

## 四、各部分推荐 JSON 结构（简版）

### 1. 定义与简称

```json
{
  "terms": [
    {
      "short_name": "本所",
      "meaning": "江苏剑桥颐华（苏州）律师事务所"
    }
  ]
}
```

### 2. 主要法律、财务问题综述

```json
{
  "issues": [
    {
      "title": "人员转移安排及成本问题",
      "description": "……",
      "risk": "……",
      "suggestion": "……"
    }
  ]
}
```

### 3. 基本情况及历史沿革

```json
{
  "basic_info": {
    "company_name": "",
    "registered_address": "",
    "company_type": "",
    "registered_capital": "",
    "paid_in_capital": "",
    "credit_code": "",
    "legal_representative": "",
    "established_date": "",
    "business_term": "",
    "business_scope": "",
    "registration_authority": ""
  },
  "history": [
    {
      "date": "",
      "event": ""
    }
  ]
}
```

### 4. 分支机构及对外投资

```json
{
  "branches": {
    "has_branch": "",
    "notes": ""
  },
  "investments": [
    {
      "company_name": "",
      "relationship": "",
      "control_status": ""
    }
  ]
}
```

### 5. 企业资质及业务许可

```json
{
  "qualifications": [
    {
      "certificate_name": "",
      "certificate_no": "",
      "issuing_authority": "",
      "validity": ""
    }
  ],
  "licenses": [
    {
      "license_name": "",
      "license_no": "",
      "content": "",
      "validity": ""
    }
  ]
}
```

### 6. 公司治理结构与经营管理

```json
{
  "governance_members": [
    {
      "name": "",
      "position": ""
    }
  ],
  "governance_features": [],
  "management_notes": []
}
```

### 7. 财务情况及主要资产

```json
{
  "financial_summary": {
    "income_statement": {
      "revenue": "",
      "cost": "",
      "operating_profit": "",
      "total_profit": "",
      "net_profit": ""
    },
    "balance_sheet": {
      "total_assets": "",
      "total_liabilities": "",
      "total_equity": "",
      "cash": "",
      "accounts_receivable": "",
      "inventory": "",
      "fixed_assets": "",
      "intangible_assets": ""
    }
  },
  "assets": {
    "land_and_buildings": [],
    "fixed_assets": [],
    "inventory": [],
    "intellectual_property": {
      "trademarks": [],
      "patents": []
    }
  }
}
```

### 8. 主要债权债务

```json
{
  "loans": [],
  "guarantees": [],
  "mortgages": [],
  "receivables": {
    "accounts_receivable_balance": "",
    "notes": ""
  },
  "risk_notes": []
}
```

### 9. 关联交易与同业竞争

```json
{
  "controlling_shareholder": [],
  "actual_controller": [],
  "subsidiaries_and_associates": [],
  "other_related_parties": [],
  "related_transactions": [],
  "horizontal_competition": []
}
```

### 10. 税务情况及财政补贴

```json
{
  "taxes": [
    {
      "tax_name": "",
      "tax_base": "",
      "tax_rate": ""
    }
  ],
  "tax_preferences": [
    {
      "item": "",
      "basis": "",
      "validity": ""
    }
  ],
  "subsidies": [
    {
      "item": "",
      "basis": "",
      "period": ""
    }
  ]
}
```

### 11. 劳动用工

```json
{
  "employment_basic": {
    "employee_count": "",
    "contract_status": "",
    "management_count": "",
    "frontline_count": ""
  },
  "social_security": {
    "social_insurance_count": "",
    "housing_fund_count": "",
    "base": "",
    "notes": ""
  },
  "special_arrangements": [],
  "sales_staff": []
}
```

### 12. 环保、安全生产及产品质量

```json
{
  "environmental_protection": [],
  "work_safety": [],
  "quality_and_standards": []
}
```

### 13. 诉讼、仲裁案件和行政处罚

```json
{
  "litigations": [],
  "arbitrations": [],
  "administrative_penalties": []
}
```

### 14. 结论意见

```json
{
  "major_findings": [],
  "pending_items": [],
  "preliminary_conclusion": ""
}
```

---

## 五、字段设计原则

1. 能拆成字段的，尽量不要直接生成整段话
2. 列表字段优先用数组
3. 不确定的值统一填“未提供”
4. 金额、日期、编号尽量单独成字段
5. “风险提示”“律师建议”这类内容可保留为短文本字段

---

## 六、建议的页面展示方式

### 方式一：按章节审核
- 左侧：AI提取出的 JSON 字段表单
- 右侧：实时预览本章节 Markdown

### 方式二：两步式
- 第一步：审核 JSON
- 第二步：一键生成 Markdown / Word

---

## 七、最实用的落地建议

你当前测试阶段，不要一开始就做很复杂的 JSON Schema 校验。
先做“够用版”：

1. 每章一个 JSON
2. 字段固定
3. 缺失值填“未提供”
4. 审核后再渲染成段落

这样最稳，最适合先跑通流程。
