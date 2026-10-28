# 地图数据来源

多地 Ping 使用 Natural Earth 1:50m 行政区及国家轮廓数据，按中国大陆行政区筛选，并加入台湾、香港、澳门的背景轮廓。地图用于表达探针坐标和本轮测量，不表示地区的完整运营商覆盖。

- 来源：[Natural Earth Vector](https://github.com/nvkelso/natural-earth-vector)，`ne_50m_admin_1_states_provinces` 与 `ne_50m_admin_0_countries`。
- 获取日期：2026-10-28。
- 许可：[Natural Earth 公共领域使用条款](https://www.naturalearthdata.com/about/terms-of-use/)。
- 本地处理：仅保留行政区标识、中文名称、背景轮廓标记和几何坐标；坐标保留三位小数；统一球面多边形绕序以供 D3 地理运算。没有按测量结果修改几何。
- 本地数据随站点交付，不在访客运行时请求地图服务。
- 投影和点归属使用 D3 Geo；只有明确属于中国大陆且能唯一落入行政区的探针坐标参与省份地图汇总，其他位置在节点明细中展示。
