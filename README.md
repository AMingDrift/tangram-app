# 七巧板益智游戏 (Tangram Puzzle Game)

这是一个为小学数学课堂设计的七巧板互动教学工具（React / Next.js / TypeScript / Konva）。

在线演示: [https://amingdrift.github.io/tangram-app/](https://amingdrift.github.io/tangram-app/)

## 功能特点

- ➕ 右侧面板显示 7 个拼块（①~⑦），点击编号可顺时针旋转 45°
- 🧩 拖拽拼块到画布的黑色目标区域完成拼图
- 📐 碰撞检测与吸附：拼块间支持贴边吸附，靠近目标时会自动吸附
- 📁 题目管理：支持导入 / 导出 JSON（示例：[tangram-problems.json](artifacts/tangram-problems.json)）
- ✍️ 新建题目：点击"+"新建拖拽拼块后保存；已保存题目的目标以黑色显示
- 🕘 答案回放：可查看并加载历史答案，恢复每个拼块的位置
- 🎉 完成提示：全部正确放置后显示烟花特效
- 💾 数据持久化：题目与答案保存在 IndexedDB，刷新不丢失

## 技术栈

- React 19
- Next.js 15+
- TypeScript
- Tailwind CSS
- Konva.js (图形库)

## 安装和运行

1. 安装依赖:

    ```bash
    pnpm install
    ```

2. 启动开发服务器:

    ```bash
    pnpm dev
    ```

3. 在浏览器中打开 <http://localhost:3000> 查看应用

## 教学用途

这个工具可以帮助小学生：

- 认识和区分不同的几何形状
- 理解图形的旋转和变换
- 培养空间想象能力和逻辑思维
- 提高对几何图形组合的理解

## 文件结构

```
/app
  page.tsx          # 主应用页面
  layout.tsx        # 页面布局
  globals.css       # 全局样式
/components
  Sidebar/          # 侧边栏（题目列表、工具栏、对话框）
    AnswerList.tsx
    index.tsx
    ProblemList.tsx
    ToolbarButtons.tsx
    Dialog/
      AnswerDeleteDialog.tsx
      AnswerListDialog.tsx
      EditProblemDialog.tsx
      ProblemDeleteDialog.tsx
      SaveProblemDialog.tsx
  TangramCanvas/     # 画布与拼图交互组件
    CanvasStage.tsx
    index.tsx
    onDragMoveLogic.md
  ui/               # 可复用 UI 组件（按钮、对话框、输入等）
    alert-dialog.tsx
    button.tsx
    confetti.tsx
    dialog.tsx
    input.tsx
    sonner.tsx
    tooltip-button.tsx
    tooltip.tsx
/lib
  tangramUtils.ts
  utils.ts
/stores
  tangramIDBStore.ts
  tangramStore.ts
/artifacts
  tangram-problems.json   # 示例题库 JSON（上传/下载示例）
```

## 自定义

你可以通过修改文件来自定义:

- 七巧板图形的形状和颜色
- 目标轮廓的形状
- 旋转角度
- 吸附逻辑
- 烟花效果

## 许可证

MIT
