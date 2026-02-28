import "reflect-metadata";
import app from "./app";
import AppDataSource from "./data-source";

const PORT = process.env.PORT || 3000;

AppDataSource.initialize()
    .then(() => {
        console.log("🚀 NeonDB Connected via TypeORM");
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    })
    .catch((error) => console.error("Database Error:", error));