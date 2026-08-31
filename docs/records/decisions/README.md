# Decision Records

仕様・設計・運用で再利用する判断理由を append-only で保存します。

- context と source
- alternatives と trade-offs
- selected / rejected options
- consequences と review trigger
- affected current canonical

現行仕様そのものは `../../specs/current/`、current product guidance は `../../product/`、site-wide visual truth は `../../../DESIGN_RULES.md` に置きます。後から判断が変わった場合は元 record を書き換えず、新 record から supersede 関係を示します。
