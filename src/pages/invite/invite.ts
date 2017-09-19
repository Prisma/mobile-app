import {Component} from '@angular/core';
import {AlertController, NavController, NavParams} from 'ionic-angular';
import {AuthGuard} from "../auth-guard";
import {AuthService} from "../../providers/auth-service/auth-service";
import {TranslatorService} from "../../providers/translator.service";
import {UtilService} from "../../providers/util-service";
import {PatientService} from "../../providers/back-end/user.service";
import {AlbumsPage} from "../albums/albums";
import {Analytics} from '../../providers/analytics';

@Component({
  selector: 'page-invite',
  templateUrl: 'invite.html',
})
export class InvitePage extends AuthGuard {

  firstname: string = "";
  lastname: string = "";
  email: string = "";
  patientId: number;
  util: UtilService;
  private loading: boolean = false;

  constructor(public authService: AuthService, public navCtrl: NavController, public translatorService: TranslatorService,
              public alertCtrl: AlertController, public navParams: NavParams, public utilService: UtilService,
              public patientService: PatientService,
              private analytics: Analytics) {
    super(authService, navCtrl, translatorService);
    this.patientId = navParams.get("patientId") as number;
    this.util = utilService;
  }

  canInvite() {
    return this.util.checkEmail(this.email) && !!this.firstname && !!this.lastname;
  }

  invite() {
    this.analytics.track('InviteComponent::invite started');

    if (this.loading)
      return;
    this.loading = true;
    if (!this.canInvite()) {
      this.inviteError();
      this.loading = false;
      return;
    }
    const data={
      inviterId: this.authService.getCurrentUser().id + "",
      lastName: this.lastname,
      firstName: this.firstname,
      email: this.email,
      patientId: this.patientId + ""
    };
    this.patientService.inviteUser(data).toPromise().then(res => {
      if (res == true) {

        this.analytics.track('InviteComponent::invite success', data);

        this.inviteDone();
        this.navCtrl.setRoot(AlbumsPage).then(res => {
          this.loading = false;
        });
      } else {
        this.analytics.track('InviteComponent::invite error', data);

        this.inviteError();
        this.loading = false;
      }

    })
  }

  inviteError(errorMessage?: string) {
    var errorMsgDefault = this.firstname + " kon niet uitgenodigd worden.";
    this.translatorService.translate([errorMessage, errorMsgDefault], (translations) => {
      let alert = this.alertCtrl.create({
        title: errorMessage ? translations[errorMessage] : translations[errorMsgDefault],
        buttons: ['Ok']
      });
      alert.present();
    });
  }

  inviteDone() {
    var message = this.firstname + " ontvangt een e-mail met je uitnodiging.";
    this.translatorService.translate([message], (translations) => {
      let alert = this.alertCtrl.create({
        title: translations[message],
        buttons: ['Ok']
      });
      alert.present();
    });
  }
}
