import os


class Settings:
    # 数据与上传目录（Docker 部署时挂持久卷到 /data）
    DATA_DIR: str = os.getenv("DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"))

    @property
    def DB_PATH(self) -> str:
        return os.path.join(self.DATA_DIR, "db.sqlite")

    @property
    def UPLOAD_DIR(self) -> str:
        return os.path.join(self.DATA_DIR, "uploads")

    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite:///{self.DB_PATH}"

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天

    # 鉴权 Cookie
    COOKIE_NAME: str = "cr_token"
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"

    # 允许的跨域来源（生产同源部署时无需 CORS，仅本地开发需要）
    @property
    def CORS_ORIGINS(self) -> list[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return [o.strip() for o in raw.split(",") if o.strip()]

    # 注册用户上限（需求：>5 禁止注册）
    MAX_USERS: int = 5

    # 预置管理员
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

    # 智谱 GLM（需求：后端硬编码配置即可）
    GLM_API_KEY: str = os.getenv("GLM_API_KEY", "REPLACE_WITH_ZHIPU_API_KEY")
    GLM_BASE_URL: str = os.getenv("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
    GLM_MODEL: str = os.getenv("GLM_MODEL", "glm-4-plus")


settings = Settings()
