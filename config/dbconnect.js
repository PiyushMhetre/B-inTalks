import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config();

export function dbconnect(){
    mongoose.connect(process.env.DATABASE_URL)
    .then( () => {
        console.log("database connected successfully ")
    })
    .catch((error) => {
        console.log(" db connection failed")
        console.error(error);
        process.exit(1);
    })
    
}