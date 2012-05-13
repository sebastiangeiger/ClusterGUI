if (window.File && window.FileReader && window.FileList && window.Blob) {
  //Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}

$(function(){
  var Image = Backbone.Model.extend({
    initialize: function(file,url){
      this.set({url:url,file:file});
    } 
  });

  var ImageList = Backbone.Collection.extend({
    model: Image
  });

  var Images = new ImageList();

  var ImageView = Backbone.View.extend({
    tagName: "li",
    className: "image",
    template: _.template('<%= name %>: <img src="<%= imageSrc %>"/>'),
    render: function() {
      $(this.el).html(this.template({name: this.model.get('name'), imageSrc:this.model.get('url')}));
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
      var files = evt.originalEvent.dataTransfer.files;

      var reader = new FileReader();
      _.map(files, function(file){
        var reader = new FileReader();
        reader.onload = (function(theFile){
          return function(event){
            Images.add(new Image(theFile,event.target.result))
          }
        })(file);
        reader.readAsDataURL(file);
      }); 
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
      this.imageList = this.$("#list ul");
      this.footer = this.$("#footer");
      Images.bind('add', this.addOne, this);
      this.render();
    },
    render: function(){
      this.footer.text(Images.length + " images");
    },
    addOne: function(image){
      var view = new ImageView({model:image});
      $(this.imageList).append(view.render().el);
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

  