import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getDatabase, provideDatabase } from '@angular/fire/database';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }, 
    provideFirebaseApp(() => 
      initializeApp({"projectId":"datos-voltaje",
        "appId":"1:848764734360:web:93c62d82fcd46c277ab9ed",
        "databaseURL":"https://datos-voltaje-default-rtdb.firebaseio.com",
        "storageBucket":"datos-voltaje.appspot.com",
        "apiKey":"AIzaSyDR4UdKqhZ-ww3NUNCNtlkh5_KKUXAnfy4",
        "authDomain":"datos-voltaje.firebaseapp.com",
        "messagingSenderId":"848764734360"})), provideDatabase(() => getDatabase())],
  bootstrap: [AppComponent],
})
export class AppModule {}
