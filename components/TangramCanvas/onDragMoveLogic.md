# onDragMove中checkCollisionsForPiece计算碰撞检测应该拆分成两种情况，首先先记录一个useRef的变量prevBlockedStatus

checkCollisionsForPiece1: (执行前提是prevBlockedStatus为["allowed","safe"]或["blocked","stick"])

- ①. 只要检测到A图形和其他图形有有碰撞且超过阈值，则允许碰撞，更新prevBlockedStatus为["allowed","crossing"]，代表允许上方穿过
- ②. （如不满足①）只要检测到A图形和其他图形有有碰撞且未超过阈值，则阻止碰撞，更新prevBlockedStatus为["blocked","stick"]，代表阻止碰撞，当前为贴边
- ③. （如不满足①②）未检测到碰撞，则更新prevBlockedStatus为["allowed","safe"]，代表没有碰撞，当前为安全位置

checkCollisionsForPiece2: (执行前提是prevBlockedStatus为["allowed","crossing"])

- ①. 只要检测到A图形和其他图形有有碰撞（不管是否超过阈值），则继续允许碰撞，prevBlockedStatus不变应该仍为["allowed","crossing"]，代表允许上方穿过
- ②. （如不满足①）未检测到碰撞，则更新prevBlockedStatus为["allowed","safe"]，代表没有碰撞，当前为安全位置
