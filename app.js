if (window.File && window.FileReader && window.FileList && window.Blob) {
  //Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}

$(function(){
  var Image = Backbone.Model.extend({
    initialize: function(file){
      this.set({file:file});
    },
    setUrl: function(url){
      this.set({url:url});
    }
  });

  var Scene = Backbone.Model.extend({
    initialize: function(startImage,endImage){
      this.set({startImage:startImage, endImage:endImage});
    } 
  });

  var SceneList = Backbone.Collection.extend({
    model: Scene
  });

  var ImageList = Backbone.Collection.extend({
    model: Image
  });

  var Images = new ImageList();
  var Scenes = new SceneList();

  var SceneView = Backbone.View.extend({
    tagName: "span",
    className: "scene",
    render: function() {
      var startImageView = new ImageView({model: this.model.get('startImage')});
      var endImageView = new ImageView({model: this.model.get('endImage')});
      this.$el.append(startImageView.render().$el);
      this.$el.append("...");
      this.$el.append(endImageView.render().$el);
      return this;
    }
  });

  var ImageView = Backbone.View.extend({
    tagName: "span",
    className: "image",
    initialize: function(){
      this.model.bind('change', this.render, this); 
    },
    template: _.template('<img src="<%= imageSrc %>"/>'),
    render: function() {
      if(this.model.get('url')){
        this.$el.html(this.template({name: this.model.get('name'), imageSrc:this.model.get('url')}));
      } else {
        this.$el.text("Loading...");
      }
      return this;
    }
  });

  var DropZoneView = Backbone.View.extend({
    el: $('#drop_zone'),
    events: {
      "drop": "uploadFile",
      "dragover": "handleDragOver",
      "dragleave": "handleDragLeave"
    },
    uploadFile: function(evt){
      evt.stopPropagation();
      evt.preventDefault();
      $(this.el).removeClass('files_hovering_over');
      $(this.el).slideUp();
      var files = evt.originalEvent.dataTransfer.files;
      _.map(files, function(file){
        var reader = new FileReader();
        var image = new Image(file);
        Images.add(image)
        reader.onload = (function(theImage){
          return function(event){
            theImage.setUrl(event.target.result)
          }
        })(image);
        reader.readAsDataURL(file);
      }); 
      for(var i=0; i<Images.length; i+=2){
        Scenes.add(new Scene(Images.at(i),Images.at(i+1)));
      }

    },

    handleDragOver: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      event.dataTransfer.dropEffect = 'link'; // Explicitly show this is a link.
      $(this.el).addClass('files_hovering_over');
    },

    handleDragLeave: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      $(this.el).removeClass('files_hovering_over');
    }
  });

  var AppView = Backbone.View.extend({
    el: $('body'),
    initialize: function(){
      this.dropZone = new DropZoneView;
      this.sceneList = this.$("#list");
      this.footer = this.$("#footer");
      Scenes.bind('add', this.addOne, this);
      this.render();
    },
    render: function(){
      this.footer.text(Scenes.length + " scenes | " + Images.length + " images");
    },
    addOne: function(scene){
      console.log("Adding scene to appview");
      var view = new SceneView({model:scene});
      $(this.sceneList).append(view.render().el);
      this.render();
    }

  });

  var App = new AppView;

});

// class Scene
//   attr_reader :start_image_path, :end_image_path
//   def initialize(start_image,end_image)
//     @start_image_path = start_image
//     @end_image_path = end_image
//   end
// end
// 
var Scene = Backbone.Model.extend({
  initialize: function(start_image_path) {
    this.set({start_image_path: start_image_path});
  }
});
// class Cluster
//   attr_reader :scenes
//   def initialize(scene)
//     @scenes = [scene]
//   end
// 
//   def merge(another_cluster)
//     @scenes += another_cluster.scenes
//     another_cluster.empty_out!
//   end
// 
//   def empty_out!
//     @scenes = []
//   end
// end
//

  
