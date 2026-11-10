#!/bin/sh
set -e

# 兼容根路径挂载与 /app 路径挂载 (/storage 与 /app/storage)
if [ -d /storage ] && [ ! -L /app/storage ]; then
    rm -rf /app/storage
    ln -s /storage /app/storage
elif [ -d /app/storage ] && [ ! -d /storage ] && [ ! -L /storage ]; then
    ln -s /app/storage /storage
fi

# 兼容日志目录双向挂载 (/logs 与 /app/logs)
if [ -d /app/logs ] && [ ! -d /logs ] && [ ! -L /logs ]; then
    ln -s /app/logs /logs
elif [ -d /logs ] && [ ! -L /app/logs ]; then
    rm -rf /app/logs
    ln -s /logs /app/logs
fi
mkdir -p /app/logs /logs 2>/dev/null || true

# 启动 Edge TTS 微软神经语音后台微服务（若存在）
if [ -f /app/bin/tts_server.py ]; then
    echo "Starting Microsoft Edge TTS microservice..."
    python3 /app/bin/tts_server.py &
fi

# 默认内存限制与 JVM 优化参数 (防止无限制占用宿主机内存，默认最大堆512MB)
if [ -z "$JAVA_OPTS" ]; then
    JAVA_OPTS="-Xms128m -Xmx512m -XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
fi

echo "Starting reader-flash with JAVA_OPTS: ${JAVA_OPTS}"

# 启动阅读主服务
exec java ${JAVA_OPTS} -jar /app/bin/reader.jar "$@"
