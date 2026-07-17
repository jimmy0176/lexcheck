export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="text-sm font-semibold tracking-[0.12em]">HE Partners</div>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          结构化问卷与律师工作台，帮助企业更高效地完成合规信息收集与后续跟进。
        </p>

        <div className="mt-10 border-t pt-8">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground/80">联系与主体信息</p>
            <p className="mt-1">
              运营主体全称、联系电话、邮箱及备案号请在上线前替换此处占位文案。
            </p>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} HE Partners。保留所有权利。</p>
        </div>
      </div>
    </footer>
  );
}
