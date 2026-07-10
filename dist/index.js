import app from "./app.js";
import { PORT } from './constants/app.constants.js';
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
