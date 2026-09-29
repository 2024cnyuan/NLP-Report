# NLP实验

## Git常用指令

**注意：每次使用先从main分支创建一个新分支，开发之后进行合并**

### 常用流程

#### 分支正常提交

```bash
git pull                         # 拉取远程仓库最新代码，先同步队友的修改
git add .                        # 将当前所有修改加入暂存区
git commit -m "修改说明"          # 提交本次修改，并填写提交说明
git push                         # 将本地提交推送到当前远程分支
```

#### 本地有未提交代码，但需要拉取远程更新

```bash
git stash                       # 临时保存当前还没有提交的本地修改
git pull                        # 拉取并合并远程仓库最新代码
git stash pop                   # 恢复刚才临时保存的本地修改
```

> 如果自己和队友修改了同一个文件的同一部分，`git stash pop` 时可能产生冲突，需要手动解决。

#### 使用功能分支开发

```bash
git switch main                 # 切换到 main 主分支
git pull                        # 拉取远程最新 main，保证从最新代码开始开发
git switch -c feature-xxx       # 创建并切换到新的功能分支 feature-xxx
```

### 合并分支

#### 方式一：本地合并后 Push 到远程仓库

假设开发分支叫 `feature-login`，目标是合并到 `main`：

```bash
git switch main                  # 切换到 main 主分支
git pull                         # 拉取远程最新的 main，避免本地 main 过旧
git merge feature-login          # 将 feature-login 分支合并到当前 main 分支
git status                       # 检查是否有冲突，以及当前仓库状态
git push                         # 将合并后的 main 推送到远程仓库
```

如果合并时发生冲突，手动解决冲突后：

```bash
git add .                        # 将已经解决冲突的文件加入暂存区
git commit -m "解决合并冲突"      # 提交冲突解决结果
git push                         # 将最终结果推送到远程 main
```

#### 方式二：Push 功能分支，在 GitHub 仓库上通过 Pull Request 合并

首先在自己的功能分支完成开发：

```bash
git switch feature-login                         # 切换到自己的功能分支
git status                                       # 查看当前修改状态
git add .                                        # 将所有修改加入暂存区
git commit -m "完成登录功能"                       # 提交本次开发内容
git push -u origin feature-login                 # 第一次将 feature-login 推送到远程仓库
```

如果之前已经执行过：

```bash
git push -u origin feature-login
```

以后这个分支继续提交，只需要：

```bash
git push                                         # 将新的 commit 推送到远程 feature-login
```

然后进入 GitHub 仓库页面，创建 Pull Request：

```text
base: main
compare: feature-login
```

确认代码没有问题后，在 GitHub 上：

```text
Create Pull Request
        ↓
Merge Pull Request
        ↓
feature-login 合并进入 main
```

GitHub 合并完成后，本地需要同步最新的 `main`：

```bash
git switch main                  # 切换回本地 main
git pull                         # 拉取 GitHub 上已经合并完成的最新 main
```

如果功能分支已经不需要了，可以删除本地分支：

```bash
git branch -d feature-login      # 删除本地已经合并完成的 feature-login 分支
```

如果远程功能分支也不需要了：

```bash
git push origin --delete feature-login   # 删除远程 feature-login 分支
```

### Git命令合集

| 命令                   | 作用                   |
| ---------------------- | ---------------------- |
| `git status`           | 查看当前仓库状态       |
| `git pull`             | 拉取并合并远程最新代码 |
| `git push`             | 推送本地提交           |
| `git add .`            | 添加所有修改           |
| `git commit -m "说明"` | 提交修改               |
| `git diff`             | 查看未提交修改         |
| `git log --oneline`    | 查看简洁提交记录       |
| `git stash`            | 临时保存未提交修改     |
| `git stash pop`        | 恢复临时保存的修改     |
| `git fetch`            | 获取远程信息但不合并   |
| `git branch`           | 查看本地分支           |
| `git branch -a`        | 查看所有分支           |
| `git switch 分支名`    | 切换分支               |
| `git switch -c 分支名` | 创建并切换新分支       |
| `git merge 分支名`     | 合并指定分支           |
| `git clone 地址`       | 克隆仓库               |
