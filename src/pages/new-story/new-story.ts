import {Component} from "@angular/core";
import {Loading, LoadingController, NavController, NavOptions, NavParams, ViewController} from "ionic-angular";
import {Album} from "../../dto/album";
import {StoryService} from "../../providers/back-end/story.service";
import {UserStory} from "../../dto/user-story";
import {UtilService} from "../../providers/util-service";
import {API_URL, env} from "../../app/environment";
import {Transfer, TransferObject} from "@ionic-native/transfer";
import {AlbumsPage} from "../albums/albums";
import {StoryDetailsPage} from "../storydetails/storydetails";
import {StanizerService} from "../../providers/stanizer.service";
import {AuthService} from "../../providers/auth-service/auth-service";
import {AuthGuard} from "../auth-guard";
import {TranslatorService} from "../../providers/translator.service";
import {Analytics} from '../../providers/analytics';
import {Page} from 'ionic-angular/navigation/nav-util';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/from';
import 'rxjs/add/operator/switchMapTo';

@Component({
  selector: 'page-new-story',
  templateUrl: 'new-story.html',
})


export class NewStoryPage extends AuthGuard {


  methods: {
    addNewStory: string,
    replaceDescription: string,
    replaceImage: string
  } = env.methods;
  title = 'Vul het verhaal aan';
  method: string = env.methods.addNewStory;
  dataUrl: string;
  description: string;
  placeHolder: string = "Schrijf het verhaal.\nHoe meer details hoe beter.";
  youtubeLinkPlaceHolder: string = "https://www.youtube.com/watch?v=ffSnk4v3aeg";
  youtubeLink: string;
  selectedAlbum: Album;

  stanizedUrl: any;


  index: number = 0;
  oldStory: UserStory;
  util: UtilService;

//file Transfer
  loading: Loading;
  isLoading: boolean = false;

  constructor(protected authService: AuthService, public navCtrl: NavController, public translatorService: TranslatorService, public navParams: NavParams,
              private storyService: StoryService, private utilService: UtilService,
              private transfer: Transfer, public loadingCtrl: LoadingController,
              public stanizer: StanizerService,
              private analytics: Analytics) {
    super(authService, navCtrl, translatorService);
    this.translatorService.translate(this.placeHolder, value => this.placeHolder = value);
    this.method = navParams.get("method") as string;
    this.dataUrl = navParams.get("dataUrl") as string;
    this.selectedAlbum = navParams.get("album") as Album;
    this.index = navParams.get("index") as number;
    this.util = utilService;
    this.title = 'Vul het verhaal aan';
    this.oldStory = navParams.get("story") as UserStory;

    if (this.method.indexOf(env.methods.replaceDescription) >= 0) {
      this.description = this.oldStory.description;
      if (this.oldStory.source)
        if (this.oldStory.source.toLowerCase().indexOf("youtube.com") < 0)
          this.dataUrl = this.oldStory.source;
        else
          this.dataUrl = null;
    }
    this.sanitizeUrl();
    if (this.method.indexOf(env.methods.replaceImage) >= 0) {
      this.description = this.oldStory.description;
      this.commitWithLoading();
    }

    if (this.method.indexOf(env.methods.addYoutubeStory) >= 0) {
      this.title = "Kies video van Youtube";
      this.description = "Video van Youtube";
    }


    // check if source is a question answer
    /*if (navParams.get("questionAnswer")) {
      this.description = navParams.get("description");
      this.commit(); // skip to step 2 because we already have the description
    }*/

  }

  commitWithLoading() {
    if (this.isLoading)
      return;
    this.isLoading = true;
    try {

      this.commit();
    } finally {
      this.isLoading = false;
    }
  }

  commit() {
    if (this.method.indexOf(env.methods.replaceDescription) >= 0) {
      this.updateDescription();
      return;
    }
    if (this.method.indexOf(env.methods.replaceImage) >= 0) {
      this.updateImage();
      return;
    }
    let newStory: UserStory = new UserStory();
    newStory.albumId = +this.selectedAlbum.id;
    newStory.description = this.description || ".";
    newStory.creatorId = +this.authService.getCurrentUser().id || 0;
    if (this.method.indexOf(env.methods.addYoutubeStory) >= 0 && this.youtubeLink) {
      newStory.type = "youtube";
      newStory.source = this.youtubeLink;
    }
    this.storyService.addStory(+this.authService.getCurrentPatient().patient_id, newStory).toPromise().then(addedStory => {
      this.analytics.track('NewStoryComponent::saving story', {
        email: this.authService.getCurrentUser().email,
        patient_id: +this.authService.getCurrentPatient().patient_id,
        newStory,
        selectedAlbum: this.selectedAlbum
      });

      if (this.dataUrl) {
        this.uploadImage(this.authService.getCurrentPatient().patient_id, addedStory.id, this.dataUrl + "")
          .then(res => {
            this.setRoot(AlbumsPage, {
              "album": this.selectedAlbum,
            }).subscribe();
          }).catch(err => {
          console.log(err);
        });
      }
      else {
        if (this.method.indexOf(env.methods.addYoutubeStory) >= 0 && this.youtubeLink) {
          this.storyService.addYoutubeLinkAsset(this.authService.getCurrentPatient().patient_id, addedStory.id, this.youtubeLink).toPromise().then(ret => {
            this.setRoot(AlbumsPage, {
              "album": this.selectedAlbum,
            });
            return;
          });

        }
        this.setRoot(AlbumsPage, {
          "album": this.selectedAlbum,
        });
      }
    });
  }

  // TODO: workaround to replace popTo
  setRoot(pageOrViewCtrl: Page | string | ViewController, params?: any, opts?: NavOptions): Observable<any> {
    return Observable.from(this.navCtrl.setRoot(pageOrViewCtrl, params, opts));
  }


  updateDescription() {
    this.oldStory.description = this.description;
    let updatedStory = new UserStory();
    updatedStory.id = this.oldStory.id;
    updatedStory.description = this.oldStory.description;
    this.storyService.updateStory(+this.authService.getCurrentPatient().patient_id, updatedStory).toPromise().then(addedStory => {

      this.analytics.track('NewStoryComponent::updateDescription', {
        email: this.authService.getCurrentUser().email,
        patient_id: +this.authService.getCurrentPatient().patient_id,
        updatedStory,
        selectedAlbum: this.selectedAlbum
      });

      this.setRoot(StoryDetailsPage, {
        "album": this.selectedAlbum,
        "index": this.index
      });
    });
  }

  updateImage() {
    if (this.dataUrl) {
      this.uploadImage(this.authService.getCurrentPatient().patient_id, this.oldStory.id, this.dataUrl + "").then(res => {

        this.analytics.track('NewStoryComponent::uploadImage', {
          email: this.authService.getCurrentUser().email,
          patient_id: +this.authService.getCurrentPatient().patient_id,
          selectedAlbum: this.selectedAlbum,
          lastImage: this.dataUrl + ""
        });

        this.setRoot(StoryDetailsPage, {
          "album": this.selectedAlbum,
          "index": this.index
        });
      }).catch(err => {
        console.log("Upload eror :" + JSON.stringify(err));
      });
    }
  }

  public uploadImage(patientId: number | string, storyId: number | string, lastImage: string): Promise<any> {
    // Destination URL
    var url = API_URL + '/' + env.api.getPatient + '/' + patientId + '/' + env.api.getStory + '/' + storyId + '/' + env.api.getAsset;
    // File for Upload

    var options = {
      fileKey: "asset",
      fileName: "asset",
      mimeType: "image/jpeg",
      headers: {
        "Connection": "close",
        "Authorization": "Bearer " + localStorage.getItem(env.jwtToken)
      }
    };

    const fileTransfer: TransferObject = this.transfer.create();

    this.loading = this.loadingCtrl.create({
      content: 'Uploading...',
    });
    this.loading.present();
    var targetPath = this.utilService.pathForImage(lastImage);
    console.log("Path : " + targetPath);
    // Use the FileTransfer to upload the image
    return fileTransfer.upload(targetPath, url, options).then(data => {
      this.loading.dismissAll();
      //this.utilService.presentToast('Image succesful uploaded. : ' + targetPath + "\n" + JSON.stringify(data));
    }, err => {
      this.loading.dismissAll()
      // this.utilService.presentToast('Error while uploading file.' + '\n' + JSON.stringify(err));
    });
  }


  sanitizeUrl() {
    if (this.oldStory) {
      if (this.dataUrl.indexOf(env.privateImagesRegex) < 0) {
        this.stanizedUrl = this.stanizer.sanitize(this.dataUrl);
        return;
      }
      this.storyService.getImage(this.dataUrl).toPromise().then(blob => {
        this.stanizedUrl = this.stanizer.sanitize(blob);
        return;
      })
    } else {
      if (!this.method.includes(env.methods.addYoutubeStory) && (this.method.includes(env.methods.addNewStory) && this.dataUrl))
        this.stanizedUrl = this.util.pathForImage(this.dataUrl);
      return;
    }
  }

}
